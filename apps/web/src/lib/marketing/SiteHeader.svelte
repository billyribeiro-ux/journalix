<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '@strikebook/ui';
	import { Logo } from '@strikebook/ui/marketing';
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
	$effect(() => {
		void page.url.pathname;
		open = false;
	});
</script>

<svelte:window onkeydown={onWindowKeydown} />

<header class="site-header" onfocusout={onFocusOut}>
	<div class="bar">
		<a class="home" href={resolve('')} aria-label="Strikebook home">
			<Logo size={26} label="Strikebook" />
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
		background: color-mix(in oklab, var(--color-bg) 92%, transparent);
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
	}

	.primary a:hover {
		color: var(--color-ink);
		background: var(--color-surface-2);
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
		min-height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-base);
		font-weight: 500;
	}

	.mobile {
		border-top: 1px solid var(--color-line);
		padding: var(--space-2) var(--site-gutter) var(--space-6);
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
