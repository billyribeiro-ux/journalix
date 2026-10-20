<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
	import SunIcon from 'phosphor-svelte/lib/SunIcon';
	import MoonIcon from 'phosphor-svelte/lib/MoonIcon';
	import MonitorIcon from 'phosphor-svelte/lib/MonitorIcon';
	import type { JournalRepository } from '@strikebook/core';
	import type { AppEnv } from '../app/routes.ts';
	import { setAppContext } from '../app/context.ts';
	import { JournalStore } from '../app/journal.svelte.ts';
	import { Toaster } from '../app/toaster.svelte.ts';
	import Logo from '../marketing/Logo.svelte';
	import Toasts from '../primitives/Toasts.svelte';
	import Button from '../primitives/Button.svelte';
	import Spinner from '../primitives/Spinner.svelte';
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

	let drawerOpen = $state(false);
	const active = $derived(env.activeRoute());
	const showFilters = $derived(
		FILTERED_ROUTES.has(active) && journal.status === 'ready' && journal.trades.length > 0
	);
	const secondary = $derived(
		SECONDARY_NAV.filter((item) => !item.webOnly || env.platform === 'web')
	);

	$effect(() => {
		void journal.load();
	});

	// Apply the saved theme once settings load, and whenever it changes.
	$effect(() => {
		if (journal.status === 'ready') applyTheme(journal.settings.theme);
	});

	// Close the mobile drawer after navigating.
	$effect(() => {
		void active;
		drawerOpen = false;
	});

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
		if (event.key === 'Escape' && drawerOpen) drawerOpen = false;
	}
</script>

<svelte:window {onkeydown} />

<a class="skip" href="#app-main">Skip to content</a>

<div class="shell" class:drawer-open={drawerOpen}>
	<header class="mobile-bar">
		<button
			type="button"
			class="menu"
			aria-label="Open navigation"
			aria-expanded={drawerOpen}
			aria-controls="app-nav"
			onclick={() => (drawerOpen = true)}
		>
			<ListIcon size={20} />
		</button>
		<a class="brand" href={env.href({ name: 'dashboard' })}><Logo size={22} /></a>
		<a class="new-mobile" href={env.href({ name: 'trade-new' })} aria-label="New trade"
			><PlusIcon size={18} weight="bold" /></a
		>
	</header>

	{#if drawerOpen}
		<button
			type="button"
			class="scrim"
			aria-label="Close navigation"
			onclick={() => (drawerOpen = false)}
		></button>
	{/if}

	<nav class="sidebar" id="app-nav" aria-label="Main">
		<div class="sidebar-top">
			<a class="brand" href={env.href({ name: 'dashboard' })}><Logo size={24} /></a>
			<button
				type="button"
				class="close"
				aria-label="Close navigation"
				onclick={() => (drawerOpen = false)}><XIcon size={18} /></button
			>
		</div>

		<div class="new">
			<Button href={env.href({ name: 'trade-new' })} variant="primary">
				{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
				New trade
			</Button>
		</div>

		<ul role="list" class="nav">
			{#each PRIMARY_NAV as item (item.label)}
				{@const Icon = item.icon}
				<li>
					<a href={env.href(item.route)} aria-current={isActive(item) ? 'page' : undefined}>
						<Icon size={18} weight={isActive(item) ? 'fill' : 'regular'} />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
		<ul role="list" class="nav secondary">
			{#each secondary as item (item.label)}
				{@const Icon = item.icon}
				<li>
					<a href={env.href(item.route)} aria-current={isActive(item) ? 'page' : undefined}>
						<Icon size={18} weight={isActive(item) ? 'fill' : 'regular'} />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<div class="sidebar-bottom">
			<div class="themes" role="radiogroup" aria-label="Theme">
				{#each THEMES as theme (theme.value)}
					<button
						type="button"
						role="radio"
						aria-checked={journal.settings.theme === theme.value}
						aria-label={theme.label}
						title={theme.label}
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
							title="Sign out"
							onclick={() => env.signOut?.()}
						>
							<SignOutIcon size={18} />
						</button>
					{/if}
				</div>
			{:else}
				<p class="local">Local journal on this computer</p>
			{/if}
		</div>
	</nav>

	<div class="main-col">
		{#if showFilters}
			<div class="filterbar"><FilterBar /></div>
		{/if}
		<main id="app-main" class="content" tabindex="-1">
			{#if journal.status === 'loading' || journal.status === 'idle'}
				<div class="state" aria-live="polite">
					<Spinner label="Loading your journal" /> <span>Loading your journal</span>
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
		left: var(--space-2);
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
		grid-template-columns: 1fr;
		background: var(--color-bg);
	}

	.mobile-bar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--topbar-height);
		padding: 0 var(--space-3);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
	}

	.menu,
	.close,
	.new-mobile {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
	}

	.new-mobile {
		background: var(--color-signal);
		color: var(--color-signal-ink);
		width: 36px;
		height: 36px;
	}

	.brand {
		display: inline-flex;
		color: var(--color-ink);
		text-decoration: none;
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-overlay) - 1);
		border: 0;
		background: rgb(6 12 22 / 55%);
	}

	.sidebar {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: var(--z-overlay);
		width: min(var(--sidebar-width), 86vw);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-3);
		background: var(--color-surface);
		border-right: 1px solid var(--color-line);
		transform: translateX(-100%);
		transition: transform var(--duration-base) var(--ease-out);
		overflow-y: auto;
	}

	.drawer-open .sidebar {
		transform: none;
		box-shadow: var(--shadow-overlay);
	}

	.sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-2);
		min-height: 40px;
	}

	.new :global(.btn) {
		width: 100%;
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
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: 36px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--color-ink-2);
		text-decoration: none;
		font-weight: 500;
	}

	.nav a:hover {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.nav a[aria-current='page'] {
		background: var(--color-surface-2);
		color: var(--color-ink);
		box-shadow: inset 2px 0 0 var(--color-signal);
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

	.themes button {
		display: grid;
		place-items: center;
		width: 30px;
		height: 26px;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-ink-3);
	}

	.themes button[aria-checked='true'] {
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: 0 0 0 1px var(--color-line-strong);
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

	.signout {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-3);
		flex: none;
	}

	.signout:hover {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.main-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.filterbar {
		position: sticky;
		top: var(--topbar-height);
		z-index: calc(var(--z-sticky) - 1);
		padding: var(--space-2) var(--space-4);
		background: color-mix(in oklab, var(--color-bg) 92%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--color-line);
	}

	.content {
		flex: 1;
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--space-5) var(--space-4) var(--space-16);
		outline: none;
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
			transition: none;
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
	}
</style>
