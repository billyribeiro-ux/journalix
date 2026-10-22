<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { tip } from './tooltip.ts';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		/** Accessible name — required because the button has no visible text. Also the tooltip. */
		label: string;
		size?: 'sm' | 'md';
		tone?: 'default' | 'danger';
		children: Snippet;
	}

	let {
		label,
		size = 'md',
		tone = 'default',
		type = 'button',
		children,
		...rest
	}: Props = $props();
</script>

<!-- Tooltip: delayed on hover, instant on keyboard focus, Escape dismisses (primitives/tooltip.ts). -->
<button class={['icon-btn', size, tone]} {type} aria-label={label} {@attach tip(label)} {...rest}>
	<span aria-hidden="true">{@render children()}</span>
</button>

<style>
	.icon-btn {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: var(--control);
		height: var(--control);
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
		font-size: 18px;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-instant) var(--ease-out);
	}

	.sm {
		width: var(--control-sm);
		height: var(--control-sm);
		font-size: 16px;
	}

	/* Touch: 44px target; the glyph keeps its size. */
	@media (pointer: coarse) {
		.icon-btn {
			width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.icon-btn:hover:not(:disabled) {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}

		.danger:hover:not(:disabled) {
			color: var(--color-loss-text);
			background: var(--color-loss-soft);
		}
	}

	.icon-btn:focus-visible,
	.icon-btn:active {
		transition-delay: 0s;
	}

	.icon-btn:active:not(:disabled) {
		background: var(--color-pressed);
		transform: scale(0.94);
	}

	.icon-btn:disabled {
		color: var(--color-ink-3);
		opacity: 0.55;
		cursor: not-allowed;
	}

	span {
		display: inline-flex;
	}

	@media (forced-colors: active) {
		.icon-btn:disabled {
			color: GrayText;
			opacity: 1;
		}
	}
</style>
