<script lang="ts">
	import type { TooltipRow } from './chart-utils.ts';

	interface Props {
		/** Anchor point in the positioned wrapper's coordinate space (px). */
		x: number;
		y: number;
		/** Bounds the tooltip must stay inside — usually the chart wrapper's size. */
		boundsWidth: number;
		boundsHeight: number;
		title: string;
		rows: readonly TooltipRow[];
		/** Gap between the anchor and the tooltip edge. */
		offset?: number;
	}

	let { x, y, boundsWidth, boundsHeight, title, rows, offset = 12 }: Props = $props();

	let w = $state(0);
	let h = $state(0);

	const left = $derived.by(() => {
		if (w === 0) return x + offset;
		const right = x + offset;
		if (right + w <= boundsWidth) return right;
		const leftSide = x - offset - w;
		if (leftSide >= 0) return leftSide;
		return Math.max(0, Math.min(boundsWidth - w, x - w / 2));
	});

	const top = $derived.by(() => {
		if (h === 0) return y;
		const centred = y - h / 2;
		return Math.max(0, Math.min(Math.max(0, boundsHeight - h), centred));
	});
</script>

<div
	class="tooltip"
	role="tooltip"
	style:left="{left}px"
	style:top="{top}px"
	style:max-width="{Math.max(140, Math.min(260, boundsWidth))}px"
	style:visibility={w === 0 ? 'hidden' : 'visible'}
	bind:clientWidth={w}
	bind:clientHeight={h}
>
	<p class="title">{title}</p>
	{#if rows.length > 0}
		<dl>
			{#each rows as row (row.label)}
				<div class="row">
					<dt>
						{#if row.swatch}<span class="swatch" style:background={row.swatch} aria-hidden="true"
							></span>{/if}
						{row.label}
					</dt>
					<dd>{row.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</div>

<style>
	.tooltip {
		position: absolute;
		z-index: var(--z-overlay);
		pointer-events: none;
		min-width: 132px;
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-overlay);
		font-size: var(--text-xs);
		line-height: var(--leading-snug);
		color: var(--color-ink);
		white-space: nowrap;
	}

	.title {
		font-weight: 600;
		color: var(--color-ink);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	dl {
		margin: var(--space-1) 0 0;
		display: grid;
		gap: 2px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
	}

	dt {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-ink-3);
	}

	dd {
		margin: 0;
		color: var(--color-ink);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex: none;
	}
</style>
