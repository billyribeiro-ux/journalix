import type { Component } from 'svelte';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
import ChartLineIcon from 'phosphor-svelte/lib/ChartLineIcon';
import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
import BookOpenTextIcon from 'phosphor-svelte/lib/BookOpenTextIcon';
import TagIcon from 'phosphor-svelte/lib/TagIcon';
import NotePencilIcon from 'phosphor-svelte/lib/NotePencilIcon';
import WalletIcon from 'phosphor-svelte/lib/WalletIcon';
import GearSixIcon from 'phosphor-svelte/lib/GearSixIcon';
import CreditCardIcon from 'phosphor-svelte/lib/CreditCardIcon';
import type { AppRoute, RouteName } from '../app/routes.ts';

export interface NavItem {
	readonly route: AppRoute;
	readonly label: string;
	readonly icon: Component<{
		size?: number | string;
		weight?: 'regular' | 'fill' | 'bold' | 'duotone' | 'light' | 'thin';
	}>;
	/** Route names that highlight this item. */
	readonly matches: readonly RouteName[];
	readonly webOnly?: boolean;
}

export const PRIMARY_NAV: readonly NavItem[] = [
	{
		route: { name: 'dashboard' },
		label: 'Dashboard',
		icon: SquaresFourIcon,
		matches: ['dashboard']
	},
	{
		route: { name: 'trades' },
		label: 'Trades',
		icon: ListBulletsIcon,
		matches: ['trades', 'trade', 'trade-new', 'trade-edit']
	},
	{ route: { name: 'reports' }, label: 'Reports', icon: ChartLineIcon, matches: ['reports'] },
	{
		route: { name: 'calendar' },
		label: 'Calendar',
		icon: CalendarBlankIcon,
		matches: ['calendar']
	},
	{ route: { name: 'notebook' }, label: 'Notebook', icon: NotePencilIcon, matches: ['notebook'] }
];

export const SECONDARY_NAV: readonly NavItem[] = [
	{
		route: { name: 'playbooks' },
		label: 'Playbooks',
		icon: BookOpenTextIcon,
		matches: ['playbooks']
	},
	{ route: { name: 'tags' }, label: 'Tags', icon: TagIcon, matches: ['tags'] },
	{ route: { name: 'accounts' }, label: 'Accounts', icon: WalletIcon, matches: ['accounts'] },
	{ route: { name: 'settings' }, label: 'Settings', icon: GearSixIcon, matches: ['settings'] },
	{
		route: { name: 'billing' },
		label: 'Billing',
		icon: CreditCardIcon,
		matches: ['billing'],
		webOnly: true
	}
];

/** Screens where the global trade filter applies. */
export const FILTERED_ROUTES: ReadonlySet<RouteName> = new Set([
	'dashboard',
	'trades',
	'reports',
	'calendar'
]);
