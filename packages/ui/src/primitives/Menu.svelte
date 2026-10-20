<script lang="ts">
	import type { Snippet } from 'svelte';

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

	function choose(item: MenuItem): void {
		open = false;
		item.onselect();
	}

	function onkeydown(event: KeyboardEvent): void {
		const buttons = [
			...(root?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
		];
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			buttons[(index + 1) % buttons.length]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
		} else if (event.key === 'Escape') {
			open = false;
			root?.querySelector<HTMLButtonElement>('.trigger')?.focus();
		}
	}

	$effect(() => {
		if (!open) return;
		queueMicrotask(() => root?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
		const onpointer = (event: PointerEvent): void => {
			if (root && !root.contains(event.target as Node)) open = false;
		};
		document.addEventListener('pointerdown', onpointer);
		return () => document.removeEventListener('pointerdown', onpointer);
	});
</script>

<div class="menu" bind:this={root} role="presentation" {onkeydown}>
	<button
		type="button"
		class="trigger"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls="{id}-menu"
		onclick={() => (open = !open)}
	>
		{@render trigger()}
	</button>
	{#if open}
		<div class="items {align}" id="{id}-menu" role="menu" aria-label={label}>
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
		min-width: 32px;
		height: 32px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
	}

	.trigger:hover,
	.trigger[aria-expanded='true'] {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.items {
		position: absolute;
		top: calc(100% + 4px);
		z-index: var(--z-overlay);
		min-width: 180px;
		padding: var(--space-1);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-overlay);
		display: grid;
	}

	.end {
		right: 0;
	}

	.start {
		left: 0;
	}

	[role='menuitem'] {
		padding: 8px var(--space-3);
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		text-align: left;
		font-size: var(--text-sm);
	}

	[role='menuitem']:hover:not(:disabled),
	[role='menuitem']:focus-visible {
		background: var(--color-surface-2);
		outline: none;
	}

	.danger {
		color: var(--color-loss);
	}
</style>
