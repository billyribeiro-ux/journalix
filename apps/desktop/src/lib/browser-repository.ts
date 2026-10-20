/**
 * Development-only `JournalRepository` for running the desktop UI in an ordinary browser
 * (`pnpm dev` without Tauri: UI work, screenshots, end-to-end tests).
 *
 * It persists to `localStorage` under the `strikebook:` prefix and mirrors the Rust backend's
 * rules (validation, cascades, a single default provider). Provider secrets are kept in
 * `localStorage` in plain text: acceptable for a local development fallback, never for the
 * shipped app, which stores them in the OS keychain. When storage is unavailable (private
 * windows, blocked site data) everything still works in memory for the session.
 */
import * as v from 'valibot';
import {
	AccountSchema,
	DEFAULT_SETTINGS,
	IdSchema,
	JournalExportSchema,
	NoteSchema,
	PlaybookSchema,
	ProviderConfigInputSchema,
	ProviderConfigViewSchema,
	ProviderSecretSchema,
	RepositoryError,
	TagSchema,
	TradeSchema,
	UserSettingsSchema,
	type Account,
	type CrudStore,
	type JournalExport,
	type JournalRepository,
	type Note,
	type Playbook,
	type ProviderConfigView,
	type ProviderSecret,
	type Tag,
	type Trade,
	type UserSettings
} from '@strikebook/core';
import type { Bar, BarsCache, BarsCacheKey, FetchLike } from '@strikebook/core/market-data';
import { createBarsApi, secretHint, validateInput } from './repository-support.ts';

const PREFIX = 'strikebook:';

/** `localStorage` with an in-memory fallback; every access is guarded. */
class KeyValueStore {
	readonly #memory = new Map<string, string>();
	#warned = false;

	#storage(): Storage | null {
		try {
			return globalThis.localStorage ?? null;
		} catch {
			return null;
		}
	}

	#warn(error: unknown): void {
		if (this.#warned) return;
		this.#warned = true;
		console.warn(
			'Strikebook: localStorage is unavailable; data is kept in memory for this session.',
			error
		);
	}

	get(key: string): string | null {
		const storage = this.#storage();
		if (storage) {
			try {
				return storage.getItem(PREFIX + key);
			} catch (error) {
				this.#warn(error);
			}
		}
		return this.#memory.get(key) ?? null;
	}

	set(key: string, value: string): void {
		this.#memory.set(key, value);
		const storage = this.#storage();
		if (!storage) return;
		try {
			storage.setItem(PREFIX + key, value);
		} catch (error) {
			this.#warn(error);
		}
	}

	delete(key: string): void {
		this.#memory.delete(key);
		const storage = this.#storage();
		if (!storage) return;
		try {
			storage.removeItem(PREFIX + key);
		} catch (error) {
			this.#warn(error);
		}
	}
}

/** Reads a JSON value; unreadable or invalid data is reported and replaced by `fallback`. */
function readJson<S extends v.GenericSchema>(
	store: KeyValueStore,
	key: string,
	schema: S,
	fallback: v.InferOutput<S>
): v.InferOutput<S> {
	const raw = store.get(key);
	if (raw === null) return fallback;
	try {
		const parsed = v.safeParse(schema, JSON.parse(raw));
		if (parsed.success) return parsed.output;
		console.warn(`Strikebook: ignoring invalid stored "${key}"`, parsed.issues);
	} catch (error) {
		console.warn(`Strikebook: ignoring unreadable stored "${key}"`, error);
	}
	return fallback;
}

function writeJson(store: KeyValueStore, key: string, value: unknown): void {
	store.set(key, JSON.stringify(value));
}

function upsert<T extends { readonly id: string }>(list: readonly T[], item: T): T[] {
	const index = list.findIndex((x) => x.id === item.id);
	if (index === -1) return [...list, item];
	return list.map((x, i) => (i === index ? item : x));
}

interface Coverage {
	readonly from: number;
	readonly to: number;
}

/** In-memory bars cache with the same coverage semantics as the SQLite one. */
function memoryBarsCache(): BarsCache {
	const entries = new Map<string, { bars: Map<number, Bar>; coverage: Coverage[] }>();
	const id = (key: BarsCacheKey) => `${key.provider}|${key.instrument}|${key.timeframe}`;

	return {
		async read(key, from, to) {
			const entry = entries.get(id(key));
			if (!entry) return null;
			let reached = from;
			for (const range of [...entry.coverage].sort((a, b) => a.from - b.from)) {
				if (range.from > reached) break;
				reached = Math.max(reached, range.to);
			}
			if (reached < to) return null;
			return [...entry.bars.values()]
				.filter((b) => b.time * 1000 <= to && b.time * 1000 >= from - 7 * 86_400_000)
				.sort((a, b) => a.time - b.time);
		},
		async write(key, bars, from, to) {
			const entry = entries.get(id(key)) ?? { bars: new Map<number, Bar>(), coverage: [] };
			for (const bar of bars) entry.bars.set(bar.time, bar);
			entry.coverage.push({ from, to });
			entries.set(id(key), entry);
		}
	};
}

const now = () => new Date().toISOString();

export function createBrowserRepository(): JournalRepository {
	const store = new KeyValueStore();

	const keys = {
		accounts: 'accounts',
		tags: 'tags',
		playbooks: 'playbooks',
		notes: 'notes',
		trades: 'trades',
		settings: 'settings',
		providers: 'providers',
		secrets: 'provider-secrets'
	} as const;

	const load = {
		accounts: () => readJson(store, keys.accounts, v.array(AccountSchema), []),
		tags: () => readJson(store, keys.tags, v.array(TagSchema), []),
		playbooks: () => readJson(store, keys.playbooks, v.array(PlaybookSchema), []),
		notes: () => readJson(store, keys.notes, v.array(NoteSchema), []),
		trades: () => readJson(store, keys.trades, v.array(TradeSchema), []),
		settings: () => readJson(store, keys.settings, UserSettingsSchema, DEFAULT_SETTINGS),
		providers: () => readJson(store, keys.providers, v.array(ProviderConfigViewSchema), []),
		secrets: () => readJson(store, keys.secrets, v.record(IdSchema, ProviderSecretSchema), {})
	};

	/** Rejects trades that point at missing records, like the SQLite foreign keys do. */
	function checkReferences(trade: Trade): void {
		if (!load.accounts().some((a) => a.id === trade.accountId)) {
			throw new RepositoryError('A referenced record does not exist (account)', 409);
		}
		if (trade.playbookId !== null && !load.playbooks().some((p) => p.id === trade.playbookId)) {
			throw new RepositoryError('A referenced record does not exist (playbook)', 409);
		}
		const tagIds = new Set(load.tags().map((t) => t.id));
		if (!trade.tagIds.every((id) => tagIds.has(id))) {
			throw new RepositoryError('A referenced record does not exist (tag)', 409);
		}
	}

	function simpleStore<S extends v.GenericSchema<unknown, { readonly id: string }>>(
		schema: S,
		key: string,
		what: string,
		read: () => v.InferOutput<S>[],
		onRemove?: (id: string) => void
	): CrudStore<v.InferOutput<S>> {
		return {
			async list() {
				return read();
			},
			async save(entity) {
				const valid = validateInput(schema, entity, what);
				writeJson(store, key, upsert(read(), valid));
				return valid;
			},
			async remove(id) {
				validateInput(IdSchema, id, `${what} id`);
				writeJson(
					store,
					key,
					read().filter((x) => x.id !== id)
				);
				onRemove?.(id);
			}
		};
	}

	const accounts = simpleStore(AccountSchema, keys.accounts, 'account', load.accounts, (id) => {
		writeJson(
			store,
			keys.trades,
			load.trades().filter((t) => t.accountId !== id)
		);
	});
	const tags = simpleStore(TagSchema, keys.tags, 'tag', load.tags, (id) => {
		writeJson(
			store,
			keys.trades,
			load
				.trades()
				.map((t) =>
					t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t
				)
		);
	});
	const playbooks = simpleStore(
		PlaybookSchema,
		keys.playbooks,
		'playbook',
		load.playbooks,
		(id) => {
			writeJson(
				store,
				keys.trades,
				load.trades().map((t) => (t.playbookId === id ? { ...t, playbookId: null } : t))
			);
		}
	);
	const notes = simpleStore(NoteSchema, keys.notes, 'note', load.notes);

	const providerSource = {
		async list(): Promise<ProviderConfigView[]> {
			return load.providers();
		},
		async secret(id: string): Promise<ProviderSecret> {
			return load.secrets()[id] ?? {};
		}
	};
	const devFetch: FetchLike = (input, init) => globalThis.fetch(input, init);
	const barsApi = createBarsApi({
		source: providerSource,
		fetch: devFetch,
		cache: memoryBarsCache()
	});

	function writeEntities(data: JournalExport): void {
		writeJson(store, keys.settings, data.settings);
		const merge = <T extends { readonly id: string }>(
			current: readonly T[],
			incoming: readonly T[]
		) => incoming.reduce<T[]>((list, item) => upsert(list, item), [...current]);
		writeJson(store, keys.accounts, merge<Account>(load.accounts(), data.accounts));
		writeJson(store, keys.tags, merge<Tag>(load.tags(), data.tags));
		writeJson(store, keys.playbooks, merge<Playbook>(load.playbooks(), data.playbooks));
		writeJson(store, keys.notes, merge<Note>(load.notes(), data.notes));
		writeJson(store, keys.trades, merge<Trade>(load.trades(), data.trades));
	}

	return {
		kind: 'desktop',
		accounts,
		tags,
		playbooks,
		notes,
		trades: {
			async list() {
				return load.trades();
			},
			async get(id) {
				validateInput(IdSchema, id, 'trade id');
				return load.trades().find((t) => t.id === id) ?? null;
			},
			async save(trade) {
				const valid = validateInput(TradeSchema, trade, 'trade');
				checkReferences(valid);
				writeJson(store, keys.trades, upsert(load.trades(), valid));
				return valid;
			},
			async remove(id) {
				validateInput(IdSchema, id, 'trade id');
				writeJson(
					store,
					keys.trades,
					load.trades().filter((t) => t.id !== id)
				);
			}
		},
		settings: {
			async get(): Promise<UserSettings> {
				return load.settings();
			},
			async save(settings) {
				const valid = validateInput(UserSettingsSchema, settings, 'settings');
				writeJson(store, keys.settings, valid);
				return valid;
			}
		},
		providers: {
			list: providerSource.list,
			async save(input) {
				const valid = validateInput(ProviderConfigInputSchema, input, 'provider');
				const providers = load.providers();
				const existing = providers.find((p) => p.id === valid.id);
				const isDefault =
					valid.isDefault || !providers.some((p) => p.isDefault && p.id !== valid.id);
				const timestamp = now();
				const view: ProviderConfigView = {
					id: valid.id,
					provider: valid.provider,
					label: valid.label,
					options: valid.options,
					isDefault,
					secretHint:
						valid.secret === null ? (existing?.secretHint ?? null) : secretHint(valid.secret),
					createdAt: existing?.createdAt ?? timestamp,
					updatedAt: timestamp
				};
				const others = isDefault
					? providers.map((p) => (p.isDefault ? { ...p, isDefault: false } : p))
					: providers;
				writeJson(store, keys.providers, upsert(others, view));
				if (valid.secret !== null) {
					const secrets = load.secrets();
					writeJson(store, keys.secrets, { ...secrets, [valid.id]: valid.secret });
				}
				return view;
			},
			async remove(id) {
				validateInput(IdSchema, id, 'provider id');
				const providers = load.providers();
				const removed = providers.find((p) => p.id === id);
				let remaining = providers.filter((p) => p.id !== id);
				if (removed?.isDefault && remaining.length > 0) {
					const oldest = [...remaining].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
					remaining = remaining.map((p) => (p.id === oldest?.id ? { ...p, isDefault: true } : p));
				}
				writeJson(store, keys.providers, remaining);
				const { [id]: _removed, ...secrets } = load.secrets();
				writeJson(store, keys.secrets, secrets);
			},
			test: (id) => barsApi.test(validateInput(IdSchema, id, 'provider id'))
		},
		bars: {
			get: (request, providerId = null) => barsApi.get(request, providerId)
		},
		data: {
			async exportAll() {
				return {
					format: 'strikebook.journal',
					version: 1,
					exportedAt: now(),
					settings: load.settings(),
					accounts: load.accounts(),
					tags: load.tags(),
					playbooks: load.playbooks(),
					notes: load.notes(),
					trades: load.trades()
				};
			},
			async importAll(data) {
				const valid = validateInput(JournalExportSchema, data, 'journal file');
				const accountIds = new Set([...load.accounts(), ...valid.accounts].map((a) => a.id));
				if (!valid.trades.every((t) => accountIds.has(t.accountId))) {
					throw new RepositoryError('A referenced record does not exist (account)', 409);
				}
				writeEntities(valid);
				return { trades: valid.trades.length };
			},
			async reset() {
				for (const key of [keys.trades, keys.notes, keys.tags, keys.playbooks, keys.accounts])
					store.delete(key);
			}
		}
	};
}
