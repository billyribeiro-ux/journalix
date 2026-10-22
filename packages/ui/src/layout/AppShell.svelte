<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { MediaQuery } from 'svelte/reactivity';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import SidebarSimpleIcon from 'phosphor-svelte/lib/SidebarSimpleIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
	import SunIcon from 'phosphor-svelte/lib/SunIcon';
	import MoonIcon from 'phosphor-svelte/lib/MoonIcon';
	import MonitorIcon from 'phosphor-svelte/lib/MonitorIcon';
	import type { JournalRepository } from '@journalix/core';
	import type { AppEnv } from '../app/routes.ts';
	import { setAppContext } from '../app/context.ts';
	import { JournalStore } from '../app/journal.svelte.ts';
	import { Toaster } from '../app/toaster.svelte.ts';
	import Logo from '../marketing/Logo.svelte';
	import Toasts from '../primitives/Toasts.svelte';
	import Button from '../primitives/Button.svelte';
	import { installReveals } from '../primitives/reveal.ts';
	import { installTooltips, tip } from '../primitives/tooltip.ts';
	import FilterBar from './FilterBar.svelte';
	import { FILTERED_ROUTES, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from './nav.ts';
	import { applyTheme, type ThemeChoice } from './theme.ts';

	interface Props {
		env: AppEnv;
		repo: JournalRepository;
		children: Snippet;
	}

	let { env, repo, children }: Props = $props();

	// The repository and environment are fixed for the shell's lifetime.
	const journal = new JournalStore(untrack(() => repo));
	const toaster = new Toaster();
	setAppContext({
		get env() {
			return env;
		},
		repo: journal.repo,
		journal,
		toaster
	});

	const SIDEBAR_KEY = 'journalix-sidebar';

	let drawerOpen = $state(false);
	/** Desktop icon rail. Remembered on this device; the mobile drawer is never collapsed. */
	let collapsed = $state(false);
	let menuButton = $state<HTMLButtonElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);
	// Only needed to make the page behind an open drawer inert; layout itself is pure CSS.
	const narrow = new MediaQuery('max-width: 1023.98px', false);
	const active = $derived(env.activeRoute());
	const showFilters = $derived(
		FILTERED_ROUTES.has(active) && journal.status === 'ready' && journal.trades.length > 0
	);
	const secondary = $derived(
		SECONDARY_NAV.filter((item) => !item.webOnly || env.platform === 'web')
	);
	const loading = $derived(journal.status === 'loading' || journal.status === 'idle');
	const behindDrawer = $derived(drawerOpen && narrow.current);
	/** The rail is a desktop-only state; below 1024px the drawer always shows labels. */
	const rail = $derived(collapsed && !narrow.current);

	$effect(() => {
		void journal.load();
	});

	// Screens put `data-tip` on their own elements; one controller serves all of them.
	$effect(() => installTooltips());

	// Panels and page headers carry `data-reveal`; one controller reveals them as they scroll in.
	$effect(() => installReveals());

	// Apply the saved theme once settings load, and whenever it changes.
	$effect(() => {
		if (journal.status === 'ready') applyTheme(journal.settings.theme);
	});

	// Close the mobile drawer after navigating.
	$effect(() => {
		void active;
		drawerOpen = false;
	});

	// static/theme-init.js already put the saved rail state on <html> before first paint (so the
	// CSS below is right from the first frame); mirror it into state for aria and tooltips. An
	// attachment runs only in the browser, once, so SSR never reads `document`.
	const mirrorRail: Attachment<HTMLElement> = () => {
		collapsed = document.documentElement.dataset['sidebar'] === 'collapsed';
	};

	async function openDrawer(): Promise<void> {
		drawerOpen = true;
		await tick();
		closeButton?.focus();
	}

	async function closeDrawer(): Promise<void> {
		drawerOpen = false;
		// The bar is `inert` while the drawer is open; wait for that to clear before focusing it.
		await tick();
		menuButton?.focus();
	}

	function toggleCollapsed(): void {
		collapsed = !collapsed;
		if (collapsed) document.documentElement.dataset['sidebar'] = 'collapsed';
		else delete document.documentElement.dataset['sidebar'];
		try {
			localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
		} catch {
			// Storage unavailable: the choice still applies for this session.
		}
	}

	async function setTheme(choice: ThemeChoice): Promise<void> {
		applyTheme(choice);
		try {
			await journal.saveSettings({ ...journal.settings, theme: choice });
		} catch (error) {
			toaster.error('Could not save the theme', error instanceof Error ? error.message : undefined);
		}
	}

	const THEMES: readonly { value: ThemeChoice; label: string }[] = [
		{ value: 'system', label: 'System theme' },
		{ value: 'light', label: 'Light theme' },
		{ value: 'dark', label: 'Dark theme' }
	];

	function isActive(item: NavItem): boolean {
		return item.matches.includes(active);
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && drawerOpen) void closeDrawer();
	}

	// Theme radios: one tab stop, arrow keys move and select (like Segmented).
	function onthemekeydown(event: KeyboardEvent): void {
		const index = THEMES.findIndex((t) => t.value === journal.settings.theme);
		const delta =
			event.key === 'ArrowRight' || event.key === 'ArrowDown'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
					? -1
					: 0;
		if (delta === 0) return;
		event.preventDefault();
		const next = (index + delta + THEMES.length) % THEMES.length;
		const choice = THEMES[next];
		if (!choice) return;
		void setTheme(choice.value);
		(event.currentTarget as HTMLElement)
			.querySelectorAll<HTMLButtonElement>('[role="radio"]')
			[next]?.focus();
	}
</script>

<svelte:window {onkeydown} />

{#snippet navList(items: readonly NavItem[], divided: boolean)}
	<ul role="list" class={['nav', divided && 'secondary']}>
		{#each items as item (item.label)}
			{const Icon = $derived(item.icon)}
			<li>
				<a
					href={env.href(item.route)}
					aria-current={isActive(item) ? 'page' : undefined}
					{@attach tip(rail ? item.label : undefined, 'side')}
				>
					<Icon size={18} weight={isActive(item) ? 'fill' : 'regular'} />
					<span class="label">{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<a class="skip" href="#app-main">Skip to content</a>

<div class={['shell', drawerOpen && 'drawer-open']} {@attach mirrorRail}>
	<header class="mobile-bar" inert={behindDrawer}>
		<button
			type="button"
			class="menu"
			bind:this={menuButton}
			aria-label="Open navigation"
			aria-expanded={drawerOpen}
			aria-controls="app-nav"
			onclick={openDrawer}
			{@attach tip('Open navigation', 'bottom')}
		>
			<ListIcon size={20} />
		</button>
		<a class="brand tap-target" href={env.href({ name: 'dashboard' })}><Logo size={22} /></a>
		<a
			class="new-mobile"
			href={env.href({ name: 'trade-new' })}
			aria-label="New trade"
			{@attach tip('New trade', 'bottom')}><PlusIcon size={18} weight="bold" /></a
		>
	</header>

	{#if drawerOpen}
		<button type="button" class="scrim" aria-label="Close navigation" onclick={closeDrawer}
		></button>
	{/if}

	<nav class="sidebar" id="app-nav" aria-label="Main">
		<div class="sidebar-top">
			<a class="brand" href={env.href({ name: 'dashboard' })}><Logo size={24} /></a>
			<button
				type="button"
				class="close"
				bind:this={closeButton}
				aria-label="Close navigation"
				onclick={closeDrawer}><XIcon size={18} /></button
			>
		</div>

		<div class="new">
			<Button href={env.href({ name: 'trade-new' })} variant="primary">
				{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
				New trade
			</Button>
		</div>

		{@render navList(PRIMARY_NAV, false)}
		{@render navList(secondary, true)}

		<div class="sidebar-bottom">
			<div
				class="themes"
				role="radiogroup"
				aria-label="Theme"
				tabindex="-1"
				onkeydown={onthemekeydown}
			>
				{#each THEMES as theme (theme.value)}
					<button
						type="button"
						role="radio"
						aria-checked={journal.settings.theme === theme.value}
						aria-label={theme.label}
						tabindex={journal.settings.theme === theme.value ? 0 : -1}
						{@attach tip(theme.label, rail ? 'side' : 'start')}
						onclick={() => setTheme(theme.value)}
					>
						{#if theme.value === 'system'}<MonitorIcon
								size={16}
							/>{:else if theme.value === 'light'}<SunIcon size={16} />{:else}<MoonIcon
								size={16}
							/>{/if}
					</button>
				{/each}
			</div>
			{#if env.user}
				<div class="user">
					<div class="who">
						<span class="name">{env.user.name}</span>
						<span class="email">{env.user.email}</span>
					</div>
					{#if env.signOut}
						<button
							type="button"
							class="signout"
							aria-label="Sign out"
							{@attach tip('Sign out', rail ? 'side' : 'end')}
							onclick={() => env.signOut?.()}
						>
							<SignOutIcon size={18} />
						</button>
					{/if}
				</div>
			{:else}
				<p class="local">Local journal on this computer</p>
			{/if}
			<button
				type="button"
				class="collapse"
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				aria-expanded={!collapsed}
				aria-controls="app-nav"
				{@attach tip(collapsed ? 'Expand sidebar' : 'Collapse sidebar', rail ? 'side' : 'start')}
				onclick={toggleCollapsed}
			>
				<SidebarSimpleIcon size={18} />
			</button>
		</div>
	</nav>

	<div class="main-col" inert={behindDrawer}>
		{#if showFilters}
			<div class="filterbar"><FilterBar /></div>
		{:else if loading && FILTERED_ROUTES.has(active)}
			<!-- Same box as the real bar, so it does not push the page down when the journal arrives. -->
			<div class="filterbar" aria-hidden="true">
				<div class="filters-skeleton">
					{#each [150, 128, 128, 140, 112] as width, i (i)}
						<span class="skeleton chip" style:width="{width}px"></span>
					{/each}
				</div>
			</div>
		{/if}
		<main id="app-main" class="content" tabindex="-1">
			{#if loading}
				<!-- Page-shaped placeholder: header, stat row, two panels. The sidebar and bar stay put. -->
				<div class="page-skeleton" aria-busy="true">
					<span class="visually-hidden" role="status">Loading your journal</span>
					<div class="sk-head">
						<span class="skeleton sk-title"></span>
						<span class="skeleton sk-sub"></span>
					</div>
					<div class="sk-tiles">
						{#each [0, 1, 2, 3, 4] as n (n)}
							<span class="skeleton sk-tile"></span>
						{/each}
					</div>
					<div class="sk-panels">
						<span class="skeleton sk-panel sk-tall"></span>
						<span class="skeleton sk-panel"></span>
					</div>
				</div>
			{:else if journal.status === 'error'}
				<div class="state error" role="alert">
					<h1>The journal didn’t load</h1>
					<p>{journal.error}</p>
					<Button variant="secondary" onclick={() => journal.load()}>Try again</Button>
				</div>
			{:else}
				{@render children()}
			{/if}
		</main>
	</div>
</div>

<Toasts {toaster} />

<style>
	.skip {
		position: absolute;
		inset-inline-start: var(--space-2);
		top: -100px;
		z-index: var(--z-toast);
		padding: var(--space-2) var(--space-3);
		background: var(--color-signal);
		color: var(--color-signal-ink);
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.skip:focus {
		top: var(--space-2);
	}

	.shell {
		min-height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		/* Bar sizes to itself and the content row takes the slack, so a short page never pushes
		   its content down by spreading the spare height into the first row. */
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--color-bg);
	}

	/* ---------- mobile top bar (below 1024px) ---------- */
	.mobile-bar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: content-box;
		height: var(--topbar-height);
		padding: env(safe-area-inset-top) max(var(--space-3), env(safe-area-inset-right)) 0
			max(var(--space-3), env(safe-area-inset-left));
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
	}

	.menu,
	.close,
	.new-mobile {
		display: grid;
		place-items: center;
		width: var(--control-touch);
		height: var(--control-touch);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			transform var(--duration-instant) var(--ease-out);
	}

	.menu:active,
	.close:active,
	.new-mobile:active {
		transform: scale(0.94);
	}

	.new-mobile {
		background: var(--color-signal);
		color: var(--color-signal-ink);
	}

	.brand {
		display: inline-flex;
		color: var(--color-ink);
		text-decoration: none;
		border-radius: var(--radius-sm);
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-overlay) - 1);
		border: 0;
		background: var(--color-scrim);
		animation: fade var(--duration-base) var(--ease-out);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	/* ---------- sidebar / drawer ---------- */
	.sidebar {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: var(--z-overlay);
		width: min(var(--sidebar-width), 86vw);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-3) var(--space-4);
		background: var(--color-surface);
		border-right: 1px solid var(--color-line);
		transform: translateX(-100%);
		/* Closing is quicker than opening, and `visibility` drops it from the tab order once hidden. */
		visibility: hidden;
		transition:
			transform var(--duration-fast) var(--ease-in),
			visibility 0s linear var(--duration-fast);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.drawer-open .sidebar {
		transform: none;
		visibility: visible;
		box-shadow: var(--shadow-overlay);
		transition:
			transform var(--duration-base) var(--ease-out-strong),
			visibility 0s;
	}

	.sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-2);
		min-height: 40px;
	}

	.new :global {
		.btn {
			width: 100%;
		}
	}

	.nav {
		display: grid;
		gap: 2px;
	}

	.nav.secondary {
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.nav a {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--control);
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--color-ink-2);
		text-decoration: none;
		font-weight: 500;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.nav a :global(svg) {
		flex: none;
	}

	.nav .label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (pointer: coarse) {
		.nav a {
			height: var(--control-touch);
		}
	}

	/* Hover is a lighter tint than the current page, so the two never read as the same state. */
	@media (hover: hover) and (pointer: fine) {
		.nav a:hover:not([aria-current='page']) {
			background: color-mix(in oklab, var(--color-surface-2) 60%, transparent);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.nav a:focus-visible,
	.nav a:active {
		transition-delay: 0s;
	}

	.nav a:focus-visible {
		outline-offset: -2px;
	}

	.nav a:active:not([aria-current='page']) {
		background: var(--color-pressed);
	}

	/* Current page: filled icon, ink text, tint, and a signal bar on the leading edge. */
	.nav a[aria-current='page'] {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.nav a[aria-current='page']::before {
		content: '';
		position: absolute;
		inset-block: var(--space-2);
		inset-inline-start: 0;
		width: 3px;
		border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
		background: var(--color-signal);
	}

	.sidebar-bottom {
		margin-top: auto;
		display: grid;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.themes {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
		justify-self: start;
	}

	.themes button,
	.collapse,
	.signout {
		display: grid;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--color-ink-3);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.themes button {
		width: 32px;
		height: 28px;
		border-radius: var(--radius-xs);
	}

	.themes button[aria-checked='true'] {
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow:
			0 0 0 1px var(--color-control-line),
			0 1px 2px rgb(15 27 45 / 8%);
	}

	.collapse,
	.signout {
		width: var(--control-dense);
		height: var(--control-dense);
		border-radius: var(--radius-sm);
		flex: none;
	}

	.collapse {
		display: none;
		justify-self: start;
	}

	@media (pointer: coarse) {
		.themes button {
			width: var(--control-touch);
			height: 36px;
		}

		.signout {
			width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.themes button:hover:not([aria-checked='true']),
		.collapse:hover,
		.signout:hover {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.themes button:focus-visible,
	.collapse:focus-visible,
	.signout:focus-visible,
	.themes button:active,
	.collapse:active,
	.signout:active {
		transition-delay: 0s;
	}

	.themes button:focus-visible {
		outline-offset: 0;
	}

	.user {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 0 var(--space-2);
	}

	.who {
		display: grid;
		min-width: 0;
	}

	.name {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.email,
	.local {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.local {
		padding: 0 var(--space-2);
	}

	/* ---------- main column ---------- */
	.main-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.filterbar {
		position: sticky;
		top: calc(var(--topbar-height) + env(safe-area-inset-top));
		z-index: calc(var(--z-sticky) - 1);
		padding: var(--space-2) var(--space-4);
		background: color-mix(in oklab, var(--color-bg) 92%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--color-line);
	}

	/* Wrapped filters can take 4 rows on a phone; a sticky bar that tall would eat the screen. */
	@media (max-width: 639px) {
		.filterbar {
			position: static;
		}
	}

	.content {
		/* The region that cross-fades between routes (motion.css); the sidebar and bars stay put. */
		view-transition-name: page;
		flex: 1;
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--space-5) var(--space-4) var(--space-16);
		outline: none;
	}

	.filters-skeleton {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		/* Chip height matches the real controls; touch gets the 44px they get. */
		min-height: var(--control-dense);
	}

	.chip {
		height: var(--control-dense);
	}

	@media (pointer: coarse) {
		.chip,
		.filters-skeleton {
			height: var(--control-touch);
			min-height: var(--control-touch);
		}
	}

	.page-skeleton {
		display: grid;
		gap: var(--space-6);
	}

	.sk-head {
		display: grid;
		gap: var(--space-2);
	}

	.sk-title {
		width: min(260px, 60%);
		height: 32px;
	}

	.sk-sub {
		width: min(420px, 80%);
		height: 16px;
	}

	.sk-tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-3);
	}

	.sk-tile {
		height: 84px;
		border-radius: var(--radius-md);
	}

	.sk-panels {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}

	.sk-panel {
		height: 240px;
		border-radius: var(--radius-md);
	}

	@media (min-width: 1024px) {
		.sk-panels {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}

		.sk-tall {
			height: 320px;
		}
	}

	.state {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-16) 0;
		justify-content: center;
		color: var(--color-ink-3);
	}

	.state.error {
		flex-direction: column;
		text-align: center;
	}

	.state.error h1 {
		font-size: var(--text-xl);
		color: var(--color-ink);
	}

	@media (min-width: 1024px) {
		.shell {
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
		}

		.mobile-bar,
		.close,
		.scrim {
			display: none;
		}

		.sidebar {
			position: sticky;
			top: 0;
			height: 100dvh;
			width: var(--sidebar-width);
			transform: none;
			visibility: visible;
			transition: none;
			padding-top: var(--space-4);
		}

		.drawer-open .sidebar {
			box-shadow: none;
		}

		.filterbar {
			top: 0;
			padding: var(--space-3) var(--space-8);
		}

		.content {
			padding: var(--space-6) var(--space-8) var(--space-16);
		}

		.collapse {
			display: grid;
		}

		/* Icon rail: labels leave the layout (but stay in the accessibility tree), tooltips take over. */
		:global(:root[data-sidebar='collapsed']) .shell {
			grid-template-columns: var(--sidebar-collapsed) minmax(0, 1fr);
		}

		:global(:root[data-sidebar='collapsed']) .sidebar {
			width: var(--sidebar-collapsed);
			padding-inline: var(--space-2);
			/* Tooltips open to the right of the rail, outside its box. */
			overflow: visible;
		}

		:global(:root[data-sidebar='collapsed']) .sidebar-top .brand :global(.word) {
			display: none;
		}

		:global(:root[data-sidebar='collapsed']) .sidebar-top {
			justify-content: center;
			padding: 0;
		}

		:global(:root[data-sidebar='collapsed']) .nav a {
			justify-content: center;
			padding: 0;
		}

		:global(:root[data-sidebar='collapsed']) .nav .label,
		:global(:root[data-sidebar='collapsed']) .new :global(.label),
		:global(:root[data-sidebar='collapsed']) .who,
		:global(:root[data-sidebar='collapsed']) .local {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		:global(:root[data-sidebar='collapsed']) .new :global(.btn) {
			padding: 0;
		}

		:global(:root[data-sidebar='collapsed']) .themes {
			flex-direction: column;
			justify-self: center;
		}

		:global(:root[data-sidebar='collapsed']) .user {
			justify-content: center;
			padding: 0;
		}

		:global(:root[data-sidebar='collapsed']) .collapse {
			justify-self: center;
		}

		:global(:root[data-sidebar='collapsed']) .collapse :global(svg) {
			transform: scaleX(-1);
		}
	}

	@media (forced-colors: active) {
		.nav a[aria-current='page']::before {
			forced-color-adjust: none;
			background: Highlight;
		}

		.nav a[aria-current='page'] {
			outline: 1px solid Highlight;
		}

		.themes button[aria-checked='true'] {
			forced-color-adjust: none;
			background: Highlight;
			color: HighlightText;
		}
	}
</style>
