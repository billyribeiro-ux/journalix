<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'gain' | 'loss' | 'signal' | 'outline';
		/** Optional identity colour shown as a leading dot. */
		color?: string;
		children: Snippet;
	}

	let { tone = 'neutral', color, children }: Props = $props();
</script>

<span class={['badge', tone]}>
	{#if color}<span class="dot" style:background={color} aria-hidden="true"></span>{/if}
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 var(--space-2);
		border-radius: var(--radius-xs);
		background: var(--color-surface-2);
		color: var(--color-ink-2);
		font-size: var(--text-xs);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
		white-space: nowrap;
		line-height: 1;
	}

	.gain {
		background: var(--color-gain-soft);
		color: var(--color-gain-text);
	}

	.loss {
		background: var(--color-loss-soft);
		color: var(--color-loss-text);
	}

	.signal {
		background: var(--color-signal-soft);
		color: var(--color-ink);
	}

	.outline {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-line-strong);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}

	@media (forced-colors: active) {
		.badge {
			border: 1px solid CanvasText;
		}
	}
</style>
