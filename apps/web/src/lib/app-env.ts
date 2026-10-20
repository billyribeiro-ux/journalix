import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { AppEnv, AppRoute, AppUser, RouteName } from '@strikebook/ui';

function withQuery(path: string, query: Record<string, string | undefined>): string {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
}

export function hrefFor(route: AppRoute): string {
	switch (route.name) {
		case 'dashboard':
			return resolve('/app');
		case 'trades':
			return resolve('/app/trades');
		case 'trade-new':
			return withQuery(resolve('/app/trades/new'), { duplicate: route.duplicateOf });
		case 'trade':
			return resolve('/app/trades/[id]', { id: route.id });
		case 'trade-edit':
			return resolve('/app/trades/[id]/edit', { id: route.id });
		case 'reports':
			return withQuery(resolve('/app/reports'), { tab: route.tab });
		case 'calendar':
			return resolve('/app/calendar');
		case 'playbooks':
			return resolve('/app/playbooks');
		case 'tags':
			return resolve('/app/tags');
		case 'notebook':
			return resolve('/app/notebook');
		case 'accounts':
			return resolve('/app/accounts');
		case 'settings':
			return withQuery(resolve('/app/settings'), { section: route.section });
		case 'billing':
			return resolve('/app/billing');
	}
}

const ROUTE_NAMES: Readonly<Record<string, RouteName>> = {
	'/app': 'dashboard',
	'/app/trades': 'trades',
	'/app/trades/new': 'trade-new',
	'/app/trades/[id]': 'trade',
	'/app/trades/[id]/edit': 'trade-edit',
	'/app/reports': 'reports',
	'/app/calendar': 'calendar',
	'/app/playbooks': 'playbooks',
	'/app/tags': 'tags',
	'/app/notebook': 'notebook',
	'/app/accounts': 'accounts',
	'/app/settings': 'settings',
	'/app/billing': 'billing'
};

export function createWebEnv(user: AppUser): AppEnv {
	return {
		platform: 'web',
		user,
		homeHref: resolve(''),
		href: hrefFor,
		async navigate(route, options) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefFor resolves every path
			await goto(hrefFor(route), { replace: options?.replace ?? false });
		},
		activeRoute() {
			return ROUTE_NAMES[page.route.id ?? ''] ?? 'dashboard';
		},
		async signOut() {
			const res = await fetch('/logout', { method: 'POST', redirect: 'manual' });
			void res;
			window.location.assign(resolve('login'));
		}
	};
}
