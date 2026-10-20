<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		busy?: boolean;
		href?: string;
		children: Snippet;
		icon?: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		busy = false,
		type = 'button',
		disabled = false,
		href,
		children,
		icon,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a class="btn {variant} {size}" {href} aria-disabled={disabled || undefined}>
		{#if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
		<span>{@render children()}</span>
	</a>
{:else}
	<button
		class="btn {variant} {size}"
		{type}
		disabled={disabled || busy}
		aria-busy={busy || undefined}
		{...rest}
	>
		{#if busy}
			<span class="spinner" aria-hidden="true"></span>
		{:else if icon}
			<span class="icon" aria-hidden="true">{@render icon()}</span>
		{/if}
		<span>{@render children()}</span>
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-base);
		font-weight: 500;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.btn:hover:not(:disabled) {
		background: var(--color-surface-2);
	}

	.btn:disabled,
	.btn[aria-disabled='true'] {
		opacity: 0.55;
		pointer-events: none;
	}

	.sm {
		min-height: 30px;
		padding: 0 var(--space-3);
		font-size: var(--text-sm);
	}

	.primary {
		background: var(--color-signal);
		border-color: var(--color-signal);
		color: var(--color-signal-ink);
		font-weight: 600;
	}

	.primary:hover:not(:disabled) {
		background: color-mix(in oklab, var(--color-signal) 88%, var(--color-ink));
	}

	.ghost {
		background: transparent;
		border-color: transparent;
		color: var(--color-ink-2);
	}

	.ghost:hover:not(:disabled) {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.danger {
		background: transparent;
		border-color: color-mix(in oklab, var(--color-loss) 55%, transparent);
		color: var(--color-loss);
	}

	.danger:hover:not(:disabled) {
		background: var(--color-loss-soft);
	}

	.icon {
		display: inline-flex;
		font-size: 1.1em;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
