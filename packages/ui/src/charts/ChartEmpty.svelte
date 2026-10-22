<script lang="ts">
	interface Props {
		message: string;
		height: number;
		/** Optional second line: what to do about it. */
		hint?: string;
	}

	let { message, height, hint }: Props = $props();
</script>

<div class="empty" style:min-height="{height}px" role="status">
	<!-- A quiet outline of an empty plot: three hairline rules and an axis, never data-shaped. -->
	<svg class="frame" width="72" height="40" viewBox="0 0 72 40" aria-hidden="true">
		<path d="M0 8.5H72M0 20.5H72M0 32.5H72" />
		<path class="axis" d="M0.5 0V40" />
	</svg>
	<p class="message">{message}</p>
	{#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		text-align: center;
	}

	.frame {
		margin-bottom: var(--space-2);
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.frame .axis {
		stroke: var(--chart-baseline);
	}

	.message {
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.hint {
		max-width: 40ch;
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}
</style>
