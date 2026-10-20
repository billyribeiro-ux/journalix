/**
 * `JournalRepository` backed by the Rust commands in `src-tauri` (SQLite + OS keychain).
 *
 * Payloads are validated with the core Valibot schemas before they are sent, and results are
 * validated again on the way back, so both sides of the IPC boundary enforce the same contract.
 */
import * as v from 'valibot';
import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import {
	AccountSchema,
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
	type CrudStore,
	type JournalRepository,
	type ProviderSecret
} from '@strikebook/core';
import {
	BarSchema,
	type Bar,
	type BarsCache,
	type BarsCacheKey,
	type FetchLike
} from '@strikebook/core/market-data';
import { createBarsApi, validateInput, validateOutput } from './repository-support.ts';

/** Shape of `AppError` as serialized by the Rust backend. */
const BackendErrorSchema = v.object({ code: v.string(), message: v.string() });

const STATUS_BY_CODE: Readonly<Record<string, number>> = {
	validation: 400,
	not_found: 404,
	constraint: 409
};

/** Calls a command and converts backend failures into `RepositoryError`. */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
	try {
		return await invoke<T>(command, args);
	} catch (error) {
		const backend = v.safeParse(BackendErrorSchema, error);
		if (backend.success) {
			const { code, message } = backend.output;
			throw new RepositoryError(message, STATUS_BY_CODE[code] ?? 500, [code]);
		}
		// Tauri rejects with a plain string when a command is missing or its arguments fail to deserialize.
		const message =
			typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error';
		throw new RepositoryError(`Desktop backend error (${command}): ${message}`, 500);
	}
}

interface CrudCommands<S extends v.GenericSchema> {
	readonly schema: S;
	/** Command prefix, e.g. `accounts` for `accounts_list`. */
	readonly prefix: string;
	/** Argument name the save command expects. */
	readonly arg: string;
	/** Human name used in validation messages. */
	readonly what: string;
}

function crudStore<S extends v.GenericSchema<unknown, { readonly id: string }>>(
	commands: CrudCommands<S>
): CrudStore<v.InferOutput<S>> {
	const { schema, prefix, arg, what } = commands;
	const list = v.array(schema);
	return {
		async list() {
			return validateOutput(list, await call(`${prefix}_list`), `${what} list`);
		},
		async save(entity) {
			const valid = validateInput(schema, entity, what);
			return validateOutput(schema, await call(`${prefix}_save`, { [arg]: valid }), what);
		},
		async remove(id) {
			await call(`${prefix}_remove`, { id: validateInput(IdSchema, id, `${what} id`) });
		}
	};
}

const tauriFetchLike: FetchLike = (input, init) => tauriFetch(input, init);

/** Bars cache persisted in SQLite (`bar_cache` + `bar_coverage`). */
const sqliteBarsCache: BarsCache = {
	async read(key: BarsCacheKey, from: number, to: number): Promise<Bar[] | null> {
		const bars = await call('bars_read', { key, from, to });
		return validateOutput(v.nullable(v.array(BarSchema)), bars, 'cached bars');
	},
	async write(key: BarsCacheKey, bars: readonly Bar[], from: number, to: number): Promise<void> {
		await call('bars_write', { key, bars, from, to });
	}
};

export function createTauriRepository(): JournalRepository {
	const providers = {
		async list() {
			return validateOutput(
				v.array(ProviderConfigViewSchema),
				await call('providers_list'),
				'provider list'
			);
		},
		async secret(id: string): Promise<ProviderSecret> {
			return validateOutput(
				ProviderSecretSchema,
				await call('providers_secret', { id }),
				'provider secret'
			);
		}
	};
	const barsApi = createBarsApi({
		source: providers,
		fetch: tauriFetchLike,
		cache: sqliteBarsCache
	});
	const trades = crudStore({ schema: TradeSchema, prefix: 'trades', arg: 'trade', what: 'trade' });

	return {
		kind: 'desktop',
		accounts: crudStore({
			schema: AccountSchema,
			prefix: 'accounts',
			arg: 'account',
			what: 'account'
		}),
		tags: crudStore({ schema: TagSchema, prefix: 'tags', arg: 'tag', what: 'tag' }),
		playbooks: crudStore({
			schema: PlaybookSchema,
			prefix: 'playbooks',
			arg: 'playbook',
			what: 'playbook'
		}),
		notes: crudStore({ schema: NoteSchema, prefix: 'notes', arg: 'note', what: 'note' }),
		trades: {
			...trades,
			async get(id) {
				const trade = await call('trades_get', { id: validateInput(IdSchema, id, 'trade id') });
				return validateOutput(v.nullable(TradeSchema), trade, 'trade');
			}
		},
		settings: {
			async get() {
				return validateOutput(UserSettingsSchema, await call('settings_get'), 'settings');
			},
			async save(settings) {
				const valid = validateInput(UserSettingsSchema, settings, 'settings');
				return validateOutput(
					UserSettingsSchema,
					await call('settings_save', { settings: valid }),
					'settings'
				);
			}
		},
		providers: {
			list: providers.list,
			async save(input) {
				const valid = validateInput(ProviderConfigInputSchema, input, 'provider');
				return validateOutput(
					ProviderConfigViewSchema,
					await call('providers_save', { input: valid }),
					'provider'
				);
			},
			async remove(id) {
				await call('providers_remove', { id: validateInput(IdSchema, id, 'provider id') });
			},
			test: (id) => barsApi.test(validateInput(IdSchema, id, 'provider id'))
		},
		bars: {
			get: (request, providerId = null) => barsApi.get(request, providerId)
		},
		data: {
			async exportAll() {
				return validateOutput(JournalExportSchema, await call('data_export'), 'export');
			},
			async importAll(data) {
				const valid = validateInput(JournalExportSchema, data, 'journal file');
				const result = await call('data_import', { data: valid });
				return validateOutput(
					v.object({ trades: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
					result,
					'import summary'
				);
			},
			async reset() {
				await call('data_reset');
			}
		}
	};
}
