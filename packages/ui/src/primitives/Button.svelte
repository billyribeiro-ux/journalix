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
	<a
		class={['btn', variant, size]}
		{href}
		aria-disabled={disabled || undefined}
		tabindex={disabled ? -1 : undefined}
	>
		{#if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
		<span class="label">{@render children()}</span>
	</a>
{:else}
	<button
		class={['btn', variant, size, busy && 'busy']}
		{type}
		disabled={disabled || busy}
		aria-busy={busy || undefined}
		{...rest}
	>
		{#if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
		<span class="label">{@render children()}</span>
		{#if busy}<span class="spinner" aria-hidden="true"></span>{/if}
	</button>
{/if}

<style>
	.btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--control);
		max-width: 100%;
		/* Vertical padding only matters once a label wraps; a single line is held at min-height. */
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-base);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		line-height: 1.25;
		text-align: center;
		text-decoration: none;
		/* Labels wrap rather than overflow (200% text zoom, long translations); balanced so a
		   two-line label does not leave one orphan word. */
		text-wrap: balance;
		user-select: none;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-instant) var(--ease-out);
	}

	.label {
		min-width: 0;
		overflow-wrap: break-word;
	}

	/* Hover waits --hover-delay-tint on real pointers only; press and keyboard never wait. */
	@media (hover: hover) and (pointer: fine) {
		.btn:hover:not(:disabled, [aria-disabled='true']) {
			background: var(--color-hover);
			border-color: var(--color-control-line);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.btn:focus-visible,
	.btn:active {
		transition-delay: 0s;
	}

	.btn:active:not(:disabled, [aria-disabled='true']) {
		background: var(--color-pressed);
		transform: scale(0.98);
	}

	.sm {
		min-height: var(--control-sm);
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-sm);
	}

	/* Touch: a 44px target (24px minimum is enough with a fine pointer). */
	@media (pointer: coarse) {
		.btn {
			min-height: var(--control-touch);
		}
	}

	/* Disabled reads as "not available", never as a washed-out version of the variant. */
	.btn:disabled:not(.busy),
	.btn[aria-disabled='true'] {
		background: var(--color-surface-2);
		border-color: var(--color-line);
		color: var(--color-ink-3);
		cursor: not-allowed;
		pointer-events: none;
	}

	.primary {
		background: var(--color-signal);
		border-color: var(--color-signal);
		color: var(--color-signal-ink);
		font-weight: 600;
	}

	@media (hover: hover) and (pointer: fine) {
		.primary:hover:not(:disabled, [aria-disabled='true']) {
			background: color-mix(in oklab, var(--color-signal) 90%, var(--color-ink));
			border-color: color-mix(in oklab, var(--color-signal) 90%, var(--color-ink));
		}
	}

	.primary:active:not(:disabled, [aria-disabled='true']) {
		background: color-mix(in oklab, var(--color-signal) 80%, var(--color-ink));
		border-color: color-mix(in oklab, var(--color-signal) 80%, var(--color-ink));
	}

	.ghost {
		background: transparent;
		border-color: transparent;
		color: var(--color-ink-2);
	}

	@media (hover: hover) and (pointer: fine) {
		.ghost:hover:not(:disabled, [aria-disabled='true']) {
			background: var(--color-hover);
			border-color: transparent;
			color: var(--color-ink);
		}
	}

	.ghost:disabled:not(.busy),
	.ghost[aria-disabled='true'] {
		background: transparent;
		border-color: transparent;
	}

	.danger {
		background: transparent;
		border-color: color-mix(in oklab, var(--color-loss-text) 55%, transparent);
		color: var(--color-loss-text);
	}

	@media (hover: hover) and (pointer: fine) {
		.danger:hover:not(:disabled, [aria-disabled='true']) {
			background: var(--color-loss-soft);
			border-color: var(--color-loss-text);
		}
	}

	.danger:active:not(:disabled, [aria-disabled='true']) {
		background: color-mix(in oklab, var(--color-loss-soft) 70%, var(--color-loss-text));
	}

	.icon {
		display: inline-flex;
		flex: none;
		font-size: 1.1em;
	}

	/* Busy keeps the variant's colours and the button's width: the label fades out (it stays in the
	   accessibility tree, and aria-busy is set) and a spinner takes its place. */
	.busy {
		cursor: progress;
	}

	.label,
	.icon {
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.busy .label,
	.busy .icon {
		opacity: 0;
	}

	.spinner {
		position: absolute;
		inset: 0;
		margin: auto;
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

	/* A spinner is feedback, not decoration: under reduced motion it turns slowly instead of freezing. */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: spin 1.6s linear infinite !important;
		}
	}

	@media (forced-colors: active) {
		.btn:disabled:not(.busy),
		.btn[aria-disabled='true'] {
			border-color: GrayText;
			color: GrayText;
		}
	}
</style>
