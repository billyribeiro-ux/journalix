<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		/** Accessible name — required because the button has no visible text. */
		label: string;
		size?: 'sm' | 'md';
		tone?: 'default' | 'danger';
		children: Snippet;
	}

	let { label, size = 'md', tone = 'default', type = 'button', children, ...rest }: Props = $props();
</script>

<button class="icon-btn {size} {tone}" {type} aria-label={label} title={label} {...rest}>
	<span aria-hidden="true">{@render children()}</span>
</button>

<style>
	.icon-btn {
		display: inline-grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
		font-size: 18px;
	}

	.sm {
		width: 28px;
		height: 28px;
		font-size: 16px;
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.danger:hover:not(:disabled) {
		color: var(--color-loss);
		background: var(--color-loss-soft);
	}

	.icon-btn:disabled {
		opacity: 0.45;
	}

	span {
		display: inline-flex;
	}
</style>
