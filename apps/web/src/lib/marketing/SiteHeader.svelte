<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '@journalix/ui';
	import { Logo } from '@journalix/ui/marketing';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { NAV_LINKS } from '#lib/marketing/site.ts';

	let open = $state(false);
	let toggle = $state<HTMLButtonElement>();
	let panel = $state<HTMLElement>();

	function isCurrent(href: string): boolean {
		const path = page.url.pathname;
		return path === href || path.startsWith(`${href}/`);
	}

	function close(returnFocus: boolean): void {
		if (!open) return;
		open = false;
		if (returnFocus) toggle?.focus();
	}

	function onToggle(): void {
		open = !open;
		if (open) {
			// Move focus into the menu once it is rendered.
			queueMicrotask(() => panel?.querySelector<HTMLAnchorElement>('a')?.focus());
		}
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			close(true);
		}
	}

	function onFocusOut(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (!(next instanceof Node)) return;
		const header = event.currentTarget as HTMLElement;
		if (!header.contains(next)) close(false);
	}

	// Close the menu after any navigation.
	afterNavigate(() => {
		open = false;
	});
</script>

<svelte:window onkeydown={onWindowKeydown} />

<header class="site-header" onfocusout={onFocusOut}>
	<div class="bar">
		<a class="home" href={resolve('')} aria-label="Journalix home">
			<Logo size={26} label="Journalix" />
		</a>

		<nav class="primary" aria-label="Main">
			<ul role="list">
				{#each NAV_LINKS as link (link.label)}
					<li>
						<a href={link.href()} aria-current={isCurrent(link.path) ? 'page' : undefined}
							>{link.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="actions">
			<Button href={resolve('login')} variant="ghost">Sign in</Button>
			<Button href={resolve('signup')} variant="primary">Start journaling</Button>
		</div>

		<button
			bind:this={toggle}
			type="button"
			class="menu-toggle"
			aria-expanded={open}
			aria-controls="site-menu"
			onclick={onToggle}
		>
			{#if open}
				<XIcon size={20} aria-hidden="true" />
			{:else}
				<ListIcon size={20} aria-hidden="true" />
			{/if}
			<span>Menu</span>
		</button>
	</div>

	<nav id="site-menu" class="mobile" aria-label="Main" hidden={!open} bind:this={panel}>
		<ul role="list">
			{#each NAV_LINKS as link (link.label)}
				<li>
					<a href={link.href()} aria-current={isCurrent(link.path) ? 'page' : undefined}
						>{link.label}</a
					>
				</li>
			{/each}
		</ul>
		<div class="mobile-actions">
			<Button href={resolve('signup')} variant="primary">Start journaling</Button>
			<Button href={resolve('login')} variant="secondary">Sign in</Button>
		</div>
	</nav>
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		background: color-mix(in oklab, var(--color-bg) 97%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--color-line);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-6);
		max-width: var(--site-max);
		height: 60px;
		margin: 0 auto;
		padding: 0 var(--site-gutter);
	}

	.home {
		display: inline-flex;
		color: var(--color-ink);
		text-decoration: none;
		margin-right: auto;
	}

	.primary,
	.actions {
		display: none;
	}

	ul {
		display: flex;
		gap: var(--space-1);
	}

	.primary a {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		padding: 0 var(--space-3);
		color: var(--color-ink-2);
		font-size: var(--text-base);
		font-weight: 500;
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	/* Hover intent: the tint waits a beat so a pointer crossing the bar does not flash every link;
	   keyboard focus and press respond at once. Leaving is instant. */
	@media (hover: hover) and (pointer: fine) {
		.primary a:hover {
			color: var(--color-ink);
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.primary a:focus-visible,
	.primary a:active {
		transition-delay: 0s;
	}

	.primary a[aria-current='page'] {
		color: var(--color-ink);
		box-shadow: inset 0 -2px 0 var(--color-ink);
		border-radius: 0;
	}

	.menu-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--control-touch);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-base);
		font-weight: 500;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.menu-toggle:hover {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.menu-toggle:active {
		background: var(--color-pressed);
		transition-delay: 0s;
	}

	/* A tall menu on a short landscape phone scrolls inside itself instead of running off screen. */
	.mobile {
		max-height: calc(100dvh - 60px);
		overflow-y: auto;
		overscroll-behavior: contain;
		border-top: 1px solid var(--color-line);
		padding: var(--space-2) var(--site-gutter) var(--space-6);
		animation: menu-in var(--duration-base) var(--ease-out-strong);
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}

	.mobile[hidden] {
		display: none;
	}

	.mobile ul {
		flex-direction: column;
		gap: 0;
	}

	.mobile a {
		display: flex;
		align-items: center;
		min-height: 48px;
		color: var(--color-ink);
		font-size: var(--text-md);
		font-weight: 500;
		text-decoration: none;
		border-bottom: 1px solid var(--color-line);
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.mobile a:hover {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.mobile a:focus-visible,
	.mobile a:active {
		transition-delay: 0s;
	}

	.mobile a[aria-current='page'] {
		box-shadow: inset 3px 0 0 var(--color-ink);
		padding-left: var(--space-3);
	}

	.mobile-actions {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}

	@media (min-width: 900px) {
		.primary,
		.actions {
			display: flex;
		}

		.actions {
			gap: var(--space-2);
		}

		.home {
			margin-right: var(--space-4);
		}

		.primary {
			margin-right: auto;
		}

		.menu-toggle,
		.mobile {
			display: none;
		}

		.mobile[hidden] {
			display: none;
		}
	}
</style>
