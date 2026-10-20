/**
 * Client-side journal state. Loads the whole journal once (a personal journal is thousands of
 * trades, not millions), keeps it in fine-grained `$state`, and derives every metric from it.
 * All writes go through the repository first and update local state only on success.
 */
import {
	applyFilter,
	buildTradeViews,
	computeStats,
	DEFAULT_SETTINGS,
	EMPTY_FILTER,
	type Account,
	type JournalExport,
	type JournalRepository,
	type Note,
	type Playbook,
	type ProviderConfigInput,
	type ProviderConfigView,
	type Tag,
	type Trade,
	type TradeFilter,
	type TradeView,
	type UserSettings
} from '@journalix/core';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function upsert<T extends { readonly id: string }>(list: readonly T[], item: T): T[] {
	const index = list.findIndex((x) => x.id === item.id);
	if (index === -1) return [...list, item];
	const next = [...list];
	next[index] = item;
	return next;
}

export class JournalStore {
	readonly #repo: JournalRepository;

	status = $state<LoadState>('idle');
	error = $state<string | null>(null);

	trades = $state.raw<Trade[]>([]);
	accounts = $state.raw<Account[]>([]);
	tags = $state.raw<Tag[]>([]);
	playbooks = $state.raw<Playbook[]>([]);
	notes = $state.raw<Note[]>([]);
	providers = $state.raw<ProviderConfigView[]>([]);
	settings = $state.raw<UserSettings>(DEFAULT_SETTINGS);
	filter = $state.raw<TradeFilter>(EMPTY_FILTER);

	/** Every trade with computed metrics. */
	views = $derived.by<TradeView[]>(() =>
		buildTradeViews(this.trades, {
			timeZone: this.settings.timeZone,
			breakevenThreshold: this.settings.breakevenThreshold
		})
	);

	/** Views after the global filter — what every report shows. */
	filtered = $derived.by<TradeView[]>(() =>
		applyFilter(this.views, this.filter, this.settings.timeZone)
	);

	stats = $derived(computeStats(this.filtered));

	activeAccounts = $derived(this.accounts.filter((a) => !a.archived));

	/** Starting balance of the accounts in scope, for equity and return calculations. */
	startingBalance = $derived.by(() => {
		const scope = this.filter.accountIds.length
			? this.accounts.filter((a) => this.filter.accountIds.includes(a.id))
			: this.accounts;
		return scope.reduce((total, a) => total + a.startingBalance, 0);
	});

	tagById = $derived(new Map(this.tags.map((t) => [t.id, t])));
	playbookById = $derived(new Map(this.playbooks.map((p) => [p.id, p])));
	accountById = $derived(new Map(this.accounts.map((a) => [a.id, a])));
	defaultProvider = $derived(this.providers.find((p) => p.isDefault) ?? this.providers[0] ?? null);

	constructor(repo: JournalRepository) {
		this.#repo = repo;
	}

	get repo(): JournalRepository {
		return this.#repo;
	}

	get isEmpty(): boolean {
		return this.status === 'ready' && this.trades.length === 0;
	}

	async load(): Promise<void> {
		this.status = 'loading';
		this.error = null;
		try {
			await this.refresh();
			this.status = 'ready';
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Could not load the journal';
			this.status = 'error';
		}
	}

	/** Reloads everything in place, keeping the current screen mounted. Throws on failure. */
	async refresh(): Promise<void> {
		const [settings, accounts, tags, playbooks, notes, trades, providers] = await Promise.all([
			this.#repo.settings.get(),
			this.#repo.accounts.list(),
			this.#repo.tags.list(),
			this.#repo.playbooks.list(),
			this.#repo.notes.list(),
			this.#repo.trades.list(),
			this.#repo.providers.list()
		]);
		this.settings = settings;
		this.accounts = accounts;
		this.tags = tags;
		this.playbooks = playbooks;
		this.notes = notes;
		this.trades = trades;
		this.providers = providers;
	}

	view(id: string): TradeView | undefined {
		return this.views.find((v) => v.trade.id === id);
	}

	setFilter(next: Partial<TradeFilter>): void {
		this.filter = { ...this.filter, ...next };
	}

	resetFilter(): void {
		this.filter = EMPTY_FILTER;
	}

	async saveTrade(trade: Trade): Promise<Trade> {
		const saved = await this.#repo.trades.save({ ...trade, updatedAt: new Date().toISOString() });
		this.trades = upsert(this.trades, saved);
		return saved;
	}

	async deleteTrade(id: string): Promise<void> {
		await this.#repo.trades.remove(id);
		this.trades = this.trades.filter((t) => t.id !== id);
	}

	async saveAccount(account: Account): Promise<Account> {
		const saved = await this.#repo.accounts.save(account);
		this.accounts = upsert(this.accounts, saved);
		return saved;
	}

	async deleteAccount(id: string): Promise<void> {
		await this.#repo.accounts.remove(id);
		this.accounts = this.accounts.filter((a) => a.id !== id);
		this.trades = this.trades.filter((t) => t.accountId !== id);
	}

	async saveTag(tag: Tag): Promise<Tag> {
		const saved = await this.#repo.tags.save(tag);
		this.tags = upsert(this.tags, saved);
		return saved;
	}

	async deleteTag(id: string): Promise<void> {
		await this.#repo.tags.remove(id);
		this.tags = this.tags.filter((t) => t.id !== id);
		this.trades = this.trades.map((t) =>
			t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t
		);
	}

	async savePlaybook(playbook: Playbook): Promise<Playbook> {
		const saved = await this.#repo.playbooks.save(playbook);
		this.playbooks = upsert(this.playbooks, saved);
		return saved;
	}

	async deletePlaybook(id: string): Promise<void> {
		await this.#repo.playbooks.remove(id);
		this.playbooks = this.playbooks.filter((p) => p.id !== id);
		this.trades = this.trades.map((t) => (t.playbookId === id ? { ...t, playbookId: null } : t));
	}

	async saveNote(note: Note): Promise<Note> {
		const saved = await this.#repo.notes.save({ ...note, updatedAt: new Date().toISOString() });
		this.notes = upsert(this.notes, saved);
		return saved;
	}

	async deleteNote(id: string): Promise<void> {
		await this.#repo.notes.remove(id);
		this.notes = this.notes.filter((n) => n.id !== id);
	}

	async saveSettings(settings: UserSettings): Promise<UserSettings> {
		const saved = await this.#repo.settings.save(settings);
		this.settings = saved;
		return saved;
	}

	async saveProvider(input: ProviderConfigInput): Promise<ProviderConfigView> {
		const saved = await this.#repo.providers.save(input);
		// Only one default: the server enforces it; mirror it locally.
		this.providers = upsert(
			saved.isDefault ? this.providers.map((p) => ({ ...p, isDefault: false })) : this.providers,
			saved
		);
		return saved;
	}

	async deleteProvider(id: string): Promise<void> {
		await this.#repo.providers.remove(id);
		// Removing the default promotes another config server-side; reload to reflect it.
		this.providers = await this.#repo.providers.list();
	}

	async importJournal(data: JournalExport): Promise<number> {
		const result = await this.#repo.data.importAll(data);
		await this.refresh();
		return result.trades;
	}

	async resetJournal(): Promise<void> {
		await this.#repo.data.reset();
		await this.refresh();
	}
}
