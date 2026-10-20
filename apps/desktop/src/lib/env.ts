/**
 * Navigation for the desktop host: maps the shared screens' `AppRoute`s to this app's routes.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AppEnv, AppRoute, RouteName, SaveFileRequest } from '@journalix/ui';

function withQuery(path: string, name: string, value: string | undefined): string {
	return value === undefined ? path : `${path}?${new URLSearchParams({ [name]: value })}`;
}

export function hrefFor(route: AppRoute): string {
	switch (route.name) {
		case 'dashboard':
			return resolve('/');
		case 'trades':
			return resolve('/trades');
		case 'trade-new':
			return withQuery(resolve('/trades/new'), 'duplicate', route.duplicateOf);
		case 'trade':
			return resolve('/trades/[id]', { id: route.id });
		case 'trade-edit':
			return resolve('/trades/[id]/edit', { id: route.id });
		case 'reports':
			return withQuery(resolve('/reports'), 'tab', route.tab);
		case 'calendar':
			return resolve('/calendar');
		case 'playbooks':
			return resolve('/playbooks');
		case 'tags':
			return resolve('/tags');
		case 'notebook':
			return resolve('/notebook');
		case 'accounts':
			return resolve('/accounts');
		case 'settings':
			return withQuery(resolve('/settings'), 'section', route.section);
		case 'billing':
			// Billing is a web-only concern; the desktop app is licensed locally.
			return resolve('/settings');
	}
}

const ROUTE_NAMES: Readonly<Record<string, RouteName>> = {
	'/': 'dashboard',
	'/trades': 'trades',
	'/trades/new': 'trade-new',
	'/trades/[id]': 'trade',
	'/trades/[id]/edit': 'trade-edit',
	'/reports': 'reports',
	'/calendar': 'calendar',
	'/playbooks': 'playbooks',
	'/tags': 'tags',
	'/notebook': 'notebook',
	'/accounts': 'accounts',
	'/settings': 'settings'
};

/** Writes through the native save dialog in Rust; WebKit webviews ignore `<a download>`. */
async function saveFile(file: SaveFileRequest): Promise<boolean> {
	return invoke<boolean>('file_save', { name: file.name, contents: file.contents });
}

export function createDesktopEnv(): AppEnv {
	return {
		// In a plain browser (`pnpm dev` without Tauri) screens fall back to a normal download.
		...(isTauri() ? { saveFile } : {}),
		platform: 'desktop',
		user: null,
		href: hrefFor,
		async navigate(route, options) {
			// hrefFor() builds every path with resolve(); the rule cannot see through the helper.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(hrefFor(route), { replace: options?.replace ?? false });
		},
		activeRoute() {
			const id = page.route.id;
			return (id === null ? undefined : ROUTE_NAMES[id]) ?? 'dashboard';
		}
	};
}
