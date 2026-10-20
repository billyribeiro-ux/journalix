import { createContext } from 'svelte';
import type { JournalRepository } from '@journalix/core';
import type { AppEnv } from './routes.ts';
import type { JournalStore } from './journal.svelte.ts';
import type { Toaster } from './toaster.svelte.ts';

export interface AppContext {
	readonly env: AppEnv;
	readonly repo: JournalRepository;
	readonly journal: JournalStore;
	readonly toaster: Toaster;
}

const [getAppContextInternal, setAppContextInternal] = createContext<AppContext>();

export function setAppContext(ctx: AppContext): AppContext {
	return setAppContextInternal(ctx);
}

export function useApp(): AppContext {
	return getAppContextInternal();
}
