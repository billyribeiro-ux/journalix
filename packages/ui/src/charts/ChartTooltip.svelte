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
	/**
	 * Widest the card has been while this tooltip stayed mounted. Scrubbing changes the text but the
	 * card never narrows, so its edge (and the side it flipped to) does not jitter under the pointer.
	 */
	let widest = $state(0);

	/** A finger covers what it touches, so on touch the card sits above the anchor instead of beside it. */
	const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

	const cardW = $derived(Math.max(w, widest));

	const left = $derived.by(() => {
		if (w === 0) return x + offset;
		if (coarse) return Math.max(0, Math.min(boundsWidth - cardW, x - cardW / 2));
		const right = x + offset;
		if (right + cardW <= boundsWidth) return right;
		const leftSide = x - offset - cardW;
		if (leftSide >= 0) return leftSide;
		return Math.max(0, Math.min(boundsWidth - cardW, x - cardW / 2));
	});

	const top = $derived.by(() => {
		if (h === 0) return y;
		if (coarse) {
			const above = y - h - 20;
			return above >= 0 ? above : Math.min(Math.max(0, boundsHeight - h), y + 20);
		}
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
	style:min-width="{Math.max(132, widest)}px"
	style:visibility={w === 0 ? 'hidden' : 'visible'}
	bind:offsetWidth={
		() => w,
		(v) => {
			w = v;
			if (v > widest) widest = Math.ceil(v);
		}
	}
	bind:offsetHeight={h}
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
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-overlay);
		font-size: var(--text-xs);
		line-height: var(--leading-snug);
		color: var(--color-ink);
		white-space: nowrap;
		/* Size to the content, not to the room left of the anchor: measuring happens before placement. */
		width: max-content;
		font-variant-numeric: tabular-nums;
	}

	@media (forced-colors: active) {
		.tooltip {
			border-color: CanvasText;
			box-shadow: none;
		}
	}

	.title {
		white-space: nowrap;
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

	/* Values lead: the reader has the series and wants the number, so it is the strong element. */
	dd {
		margin: 0;
		color: var(--color-ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex: none;
		forced-color-adjust: none;
	}
</style>
