<script lang="ts">
	import type { HeatCell } from '@journalix/core';
	import { formatMoney } from '@journalix/core';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import type { TableRow, TooltipRow } from './chart-utils.ts';
	import { FLAT_FILL, divergingFill, pnlAcross } from './chart-utils.ts';

	interface Props {
		cells: readonly HeatCell[];
		currency: string;
		startHour?: number;
		endHour?: number;
	}

	let { cells, currency, startHour = 9, endHour = 16 }: Props = $props();

	const uid = $props.id();

	let width = $state(0);
	let wrapHeight = $state(0);
	let gridEl = $state<HTMLDivElement>();
	let hovered = $state<string | null>(null);
	let focused = $state<string | null>(null);
	let lastFocused = $state<string | null>(null);
	let anchor = $state<{ x: number; y: number } | null>(null);

	const WEEKDAYS = [
		{ wd: 1, short: 'Mon', long: 'Monday' },
		{ wd: 2, short: 'Tue', long: 'Tuesday' },
		{ wd: 3, short: 'Wed', long: 'Wednesday' },
		{ wd: 4, short: 'Thu', long: 'Thursday' },
		{ wd: 5, short: 'Fri', long: 'Friday' }
	];

	const lo = $derived(Math.max(0, Math.min(23, Math.floor(Math.min(startHour, endHour)))));
	const hi = $derived(Math.max(0, Math.min(23, Math.floor(Math.max(startHour, endHour)))));

	interface Column {
		readonly key: string;
		readonly label: string;
		/** 24-hour form for narrow layouts, where "1" alone would be ambiguous. */
		readonly short: string;
		readonly long: string;
		readonly match: (hour: number) => boolean;
	}

	function hourLabel(h: number): string {
		const suffix = h < 12 ? 'am' : 'pm';
		const n = h % 12 === 0 ? 12 : h % 12;
		return `${n}${suffix}`;
	}

	const weekdayCells = $derived(cells.filter((c) => c.weekday >= 1 && c.weekday <= 5));
	const hasPre = $derived(weekdayCells.some((c) => c.hour < lo && c.trades > 0));
	const hasAfter = $derived(weekdayCells.some((c) => c.hour > hi && c.trades > 0));
	const weekendTrades = $derived(
		cells.filter((c) => c.weekday === 0 || c.weekday === 6).reduce((s, c) => s + c.trades, 0)
	);

	const columns = $derived.by((): Column[] => {
		const out: Column[] = [];
		if (hasPre)
			out.push({
				key: 'pre',
				label: 'Pre',
				short: 'Pre',
				long: `before ${hourLabel(lo)}`,
				match: (h) => h < lo
			});
		for (let h = lo; h <= hi; h++) {
			out.push({
				key: String(h),
				label: hourLabel(h),
				short: String(h),
				long: `${hourLabel(h)} hour`,
				match: (x) => x === h
			});
		}
		if (hasAfter)
			out.push({
				key: 'after',
				label: 'After',
				short: 'After',
				long: `after ${hourLabel(hi)} hour`,
				match: (h) => h > hi
			});
		return out;
	});

	interface Agg {
		readonly id: string;
		readonly wd: number;
		readonly col: number;
		readonly pnl: number;
		readonly trades: number;
	}

	const matrix = $derived(
		WEEKDAYS.map((day) =>
			columns.map((col, ci): Agg => {
				let pnl = 0;
				let trades = 0;
				for (const c of weekdayCells) {
					if (c.weekday === day.wd && col.match(c.hour)) {
						pnl += c.pnl;
						trades += c.trades;
					}
				}
				return { id: `${day.wd}:${col.key}`, wd: day.wd, col: ci, pnl, trades };
			})
		)
	);

	const flat = $derived(matrix.flat());
	const maxAbs = $derived(flat.reduce((m, a) => Math.max(m, Math.abs(a.pnl)), 0));
	const actionable = $derived(flat.filter((a) => a.trades > 0));
	const tabStop = $derived.by(() => {
		if (lastFocused && actionable.some((a) => a.id === lastFocused)) return lastFocused;
		return (
			actionable.reduce<Agg | null>(
				(best, a) => (best === null || a.trades > best.trades ? a : best),
				null
			)?.id ?? null
		);
	});

	const narrow = $derived(width > 0 && width < 520);

	function fillFor(a: Agg): string {
		if (a.trades === 0) return 'var(--color-surface)';
		if (a.pnl === 0) return FLAT_FILL;
		return divergingFill(a.pnl, maxAbs);
	}

	function labelFor(a: Agg): string {
		const day = WEEKDAYS.find((d) => d.wd === a.wd)?.long ?? '';
		const col = columns[a.col];
		const when = col
			? col.key === 'pre' || col.key === 'after'
				? col.long
				: `${col.label} hour`
			: '';
		return a.trades === 0
			? `${day}, ${when}: no trades`
			: `${day}, ${when}: ${pnlAcross(a.pnl, a.trades, currency)}`;
	}

	function anchorTo(el: HTMLElement): void {
		const wrap = gridEl?.parentElement;
		if (!wrap) return;
		const a = el.getBoundingClientRect();
		const b = wrap.getBoundingClientRect();
		anchor = { x: a.right - b.left - 2, y: a.top - b.top + a.height / 2 };
	}

	function onkeydown(event: KeyboardEvent, a: Agg): void {
		const rowIndex = WEEKDAYS.findIndex((d) => d.wd === a.wd);
		const moves: Record<string, [number, number]> = {
			ArrowRight: [0, 1],
			ArrowLeft: [0, -1],
			ArrowDown: [1, 0],
			ArrowUp: [-1, 0]
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			let r = rowIndex + move[0];
			let c = a.col + move[1];
			while (r >= 0 && r < WEEKDAYS.length && c >= 0 && c < columns.length) {
				const next = matrix[r]?.[c];
				if (next && next.trades > 0) {
					gridEl?.querySelector<HTMLElement>(`[data-cell="${next.id}"]`)?.focus();
					return;
				}
				r += move[0];
				c += move[1];
			}
		} else if (event.key === 'Escape') {
			hovered = null;
		}
	}

	const tipId = $derived(hovered ?? focused);
	const tip = $derived(tipId ? (flat.find((a) => a.id === tipId) ?? null) : null);

	const tooltipRows = $derived.by((): TooltipRow[] => {
		if (!tip) return [];
		return [
			{ label: 'Net P&L', value: formatMoney(tip.pnl, { currency, signed: true }) },
			{ label: 'Trades', value: String(tip.trades) }
		];
	});

	const tipTitle = $derived.by(() => {
		if (!tip) return '';
		const day = WEEKDAYS.find((d) => d.wd === tip.wd)?.long ?? '';
		const col = columns[tip.col];
		if (!col) return day;
		return col.key === 'pre' || col.key === 'after'
			? `${day}, ${col.long}`
			: `${day}, ${col.label}`;
	});

	const summary = $derived.by(() => {
		if (actionable.length === 0) return 'Weekday and hour heatmap, no trades.';
		const best = actionable.reduce((a, b) => (b.pnl > a.pnl ? b : a));
		const worst = actionable.reduce((a, b) => (b.pnl < a.pnl ? b : a));
		return `Net P&L by weekday and hour of entry. Best: ${labelFor(best)}. Worst: ${labelFor(worst)}.${weekendTrades ? ` ${weekendTrades} weekend trades are not shown.` : ''}`;
	});

	const tableRows = $derived(
		actionable.map((a): TableRow => ({
			key: a.id,
			cells: [
				labelFor(a).split(':')[0] ?? '',
				formatMoney(a.pnl, { currency, signed: true }),
				String(a.trades)
			]
		}))
	);
</script>

<figure class="heat" aria-labelledby="{uid}-cap">
	<figcaption id="{uid}-cap" class="visually-hidden">{summary}</figcaption>
	{#if actionable.length === 0}
		<ChartEmpty message="No trades to map by time in this range" height={180} />
	{:else}
		<div class="wrap" bind:clientWidth={width} bind:clientHeight={wrapHeight}>
			<div
				class={['grid', narrow && 'narrow']}
				role="grid"
				aria-label="Net P&L by weekday and hour"
				bind:this={gridEl}
				style:grid-template-columns="auto repeat({columns.length}, minmax(0, 1fr))"
			>
				<div class="row" role="row">
					<div class="corner" role="columnheader" aria-label="Weekday"></div>
					{#each columns as col (col.key)}
						<div class="colhead" role="columnheader" aria-label={col.long}>
							{narrow ? col.short : col.label}
						</div>
					{/each}
				</div>
				{#each WEEKDAYS as day, ri (day.wd)}
					<div class="row" role="row">
						<div class="rowhead" role="rowheader" aria-label={day.long}>
							{narrow ? day.short.slice(0, 2) : day.short}
						</div>
						{#each matrix[ri] ?? [] as a (a.id)}
							<div
								role="gridcell"
								class="cellwrap"
								aria-label={a.trades > 0 ? undefined : labelFor(a)}
							>
								{#if a.trades > 0}
									<button
										type="button"
										class="cell"
										data-cell={a.id}
										style:background={fillFor(a)}
										tabindex={tabStop === a.id ? 0 : -1}
										aria-label={labelFor(a)}
										onpointerenter={(e) => {
											hovered = a.id;
											anchorTo(e.currentTarget);
										}}
										onpointerleave={() => (hovered = null)}
										onfocus={(e) => {
											focused = a.id;
											lastFocused = a.id;
											anchorTo(e.currentTarget);
										}}
										onblur={() => (focused = null)}
										onkeydown={(e) => onkeydown(e, a)}
									>
										{#if a.pnl !== 0}
											<!-- Sign by shape, so gain and loss never rest on hue alone. -->
											<svg class="sign" width="7" height="6" viewBox="0 0 7 6" aria-hidden="true">
												<path d={a.pnl > 0 ? 'M3.5 0L7 6H0Z' : 'M0 0H7L3.5 6Z'} />
											</svg>
										{/if}
										{a.trades}
									</button>
								{:else}
									<div class="cell empty"></div>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</div>
			{#if tip && anchor}
				<ChartTooltip
					x={anchor.x}
					y={anchor.y}
					boundsWidth={width}
					boundsHeight={wrapHeight}
					title={tipTitle}
					rows={tooltipRows}
				/>
			{/if}
		</div>
		<p class="note">
			Cells show trade count. Colour and the corner mark show net P&amp;L: ▲ gain, ▼ loss.{weekendTrades
				? ` ${weekendTrades} weekend ${weekendTrades === 1 ? 'trade is' : 'trades are'} not shown.`
				: ''}
		</p>
		<ChartTable
			caption="Net P&L by weekday and hour"
			columns={['Slot', 'Net P&L', 'Trades']}
			rows={tableRows}
		/>
	{/if}
</figure>

<style>
	.heat {
		margin: 0;
		min-width: 0;
	}

	.wrap {
		position: relative;
		width: 100%;
		min-width: 0;
	}

	.grid {
		display: grid;
		gap: 2px;
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: contents;
	}

	.corner {
		min-width: 0;
	}

	.colhead {
		padding-bottom: var(--space-1);
		font-size: var(--text-2xs);
		color: var(--chart-text);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
	}

	.rowhead {
		display: flex;
		align-items: center;
		padding-right: var(--space-2);
		font-size: var(--text-2xs);
		color: var(--chart-text);
	}

	.cellwrap {
		display: flex;
		min-width: 0;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		min-width: 0;
		height: 36px;
		margin: 0;
		padding: 0;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-xs);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: default;
	}

	.narrow .cell {
		height: 30px;
		font-size: var(--text-2xs);
	}

	.sign {
		position: absolute;
		top: 4px;
		left: 4px;
		fill: var(--color-ink-2);
		pointer-events: none;
	}

	@media (pointer: coarse) {
		.cell,
		.narrow .cell {
			height: var(--control-touch);
		}
	}

	.cell.empty {
		border-style: solid;
		border-color: var(--chart-grid);
	}

	button.cell:hover {
		border-color: var(--color-ink-3);
	}

	button.cell:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	.note {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}
</style>
