/**
 * Storage contract shared by both apps. The web implementation talks to the SvelteKit API
 * (PostgreSQL via Drizzle); the desktop implementation talks to Tauri commands (SQLite via Rust).
 * Screens depend only on this interface, so they are written once.
 */
import type {
	Account,
	JournalExport,
	Note,
	Playbook,
	ProviderConfigInput,
	ProviderConfigView,
	Tag,
	Trade,
	UserSettings
} from '../domain/schemas.ts';
import type { BarsRequest } from '../market-data/types.ts';
import type { BarsResult } from '../market-data/service.ts';

export interface CrudStore<T extends { readonly id: string }> {
	list(): Promise<T[]>;
	save(entity: T): Promise<T>;
	remove(id: string): Promise<void>;
}

export interface ProviderTestResult {
	readonly ok: boolean;
	readonly message: string;
	readonly bars?: number;
}

export interface JournalRepository {
	readonly kind: 'web' | 'desktop';
	readonly accounts: CrudStore<Account>;
	readonly trades: CrudStore<Trade> & { get(id: string): Promise<Trade | null> };
	readonly tags: CrudStore<Tag>;
	readonly playbooks: CrudStore<Playbook>;
	readonly notes: CrudStore<Note>;
	readonly settings: {
		get(): Promise<UserSettings>;
		save(settings: UserSettings): Promise<UserSettings>;
	};
	readonly providers: {
		list(): Promise<ProviderConfigView[]>;
		save(input: ProviderConfigInput): Promise<ProviderConfigView>;
		remove(id: string): Promise<void>;
		test(id: string): Promise<ProviderTestResult>;
	};
	readonly bars: {
		get(request: BarsRequest, providerId?: string | null): Promise<BarsResult>;
	};
	readonly data: {
		exportAll(): Promise<JournalExport>;
		/** Replaces nothing: upserts every entity in the file. */
		importAll(data: JournalExport): Promise<{ readonly trades: number }>;
		/** Deletes every journal entity (keeps provider settings). */
		reset(): Promise<void>;
	};
}

export class RepositoryError extends Error {
	readonly status: number;
	readonly issues: readonly string[];

	constructor(message: string, status = 500, issues: readonly string[] = []) {
		super(message);
		this.name = 'RepositoryError';
		this.status = status;
		this.issues = issues;
	}
}
