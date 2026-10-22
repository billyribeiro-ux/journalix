<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { tip } from './tooltip.ts';

	export interface MenuItem {
		readonly label: string;
		readonly onselect: () => void;
		readonly tone?: 'default' | 'danger';
		readonly disabled?: boolean;
	}

	interface Props {
		label: string;
		items: readonly MenuItem[];
		trigger: Snippet;
		align?: 'start' | 'end';
	}

	let { label, items, trigger, align = 'end' }: Props = $props();
	const id = $props.id();
	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	function enabledItems(): HTMLButtonElement[] {
		return [
			...(root?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
		];
	}

	function focusTrigger(): void {
		root?.querySelector<HTMLButtonElement>('.trigger')?.focus();
	}

	async function toggle(): Promise<void> {
		open = !open;
		if (!open) return;
		await tick();
		enabledItems()[0]?.focus();
	}

	function choose(item: MenuItem): void {
		open = false;
		// Return focus first: if onselect opens a dialog, the dialog takes focus from here.
		focusTrigger();
		item.onselect();
	}

	function onkeydown(event: KeyboardEvent): void {
		if (!open) {
			// ArrowDown on the closed trigger opens the menu, like a native one.
			if (event.key === 'ArrowDown' && event.target === root?.querySelector('.trigger')) {
				event.preventDefault();
				void toggle();
			}
			return;
		}
		const buttons = enabledItems();
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			buttons[(index + 1) % buttons.length]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
		} else if (event.key === 'Home') {
			event.preventDefault();
			buttons[0]?.focus();
		} else if (event.key === 'End') {
			event.preventDefault();
			buttons.at(-1)?.focus();
		} else if (event.key === 'Escape') {
			open = false;
			focusTrigger();
		} else if (event.key === 'Tab') {
			// Like a native menu, Tab leaves it: close, park focus on the trigger, and let the
			// browser's default Tab continue from there.
			open = false;
			focusTrigger();
		}
	}

	function onpointerdown(event: PointerEvent): void {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}

	// Tabbing out of an open menu closes it (focus moving to a real target outside the menu).
	function onfocusout(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (open && next instanceof Node && root && !root.contains(next)) open = false;
	}
</script>

<svelte:document {onpointerdown} />

<div class="menu" bind:this={root} role="presentation" {onkeydown} {onfocusout}>
	<button
		type="button"
		class="trigger"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={open ? `${id}-menu` : undefined}
		{@attach tip(open ? undefined : label)}
		onclick={toggle}
	>
		{@render trigger()}
	</button>
	{#if open}
		<div class={['items', align]} id="{id}-menu" role="menu" aria-label={label}>
			{#each items as item (item.label)}
				<button
					type="button"
					role="menuitem"
					class={item.tone ?? 'default'}
					disabled={item.disabled}
					onclick={() => choose(item)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
		display: inline-flex;
	}

	.trigger {
		display: inline-grid;
		place-items: center;
		min-width: var(--control-dense);
		height: var(--control-dense);
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-instant) var(--ease-out);
	}

	@media (pointer: coarse) {
		.trigger {
			min-width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.trigger:hover {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.trigger[aria-expanded='true'] {
		background: var(--color-hover);
		color: var(--color-ink);
	}

	.trigger:focus-visible,
	.trigger:active {
		transition-delay: 0s;
	}

	.trigger:active {
		background: var(--color-pressed);
		transform: scale(0.94);
	}

	.items {
		position: absolute;
		top: calc(100% + var(--space-1));
		z-index: var(--z-overlay);
		display: grid;
		min-width: 180px;
		max-width: min(320px, calc(100vw - 2 * var(--space-4)));
		padding: var(--space-1);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-pop);
		animation: pop var(--duration-base) var(--ease-out-strong);
	}

	.end {
		inset-inline-end: 0;
		transform-origin: top right;
	}

	.start {
		inset-inline-start: 0;
		transform-origin: top left;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
	}

	[role='menuitem'] {
		min-height: var(--control-dense);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-ink);
		text-align: start;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		[role='menuitem'] {
			min-height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		[role='menuitem']:hover:not(:disabled) {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	/* Keyboard highlight is immediate and ringed — a tint alone is not enough contrast. */
	[role='menuitem']:focus-visible {
		background: var(--color-hover);
		outline-offset: -2px;
		transition-delay: 0s;
	}

	[role='menuitem']:active:not(:disabled) {
		background: var(--color-pressed);
		transition-delay: 0s;
	}

	[role='menuitem']:disabled {
		color: var(--color-ink-3);
		cursor: not-allowed;
	}

	.danger {
		color: var(--color-loss-text);
	}

	@media (hover: hover) and (pointer: fine) {
		.danger:hover:not(:disabled) {
			background: var(--color-loss-soft);
		}
	}

	@media (forced-colors: active) {
		[role='menuitem']:disabled {
			color: GrayText;
		}
	}
</style>
