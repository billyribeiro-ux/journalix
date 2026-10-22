<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { DailyPnl } from '@journalix/core';
	import { formatDayKey, formatMoney } from '@journalix/core';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import type { TableRow, TooltipRow } from './chart-utils.ts';
	import {
		FLAT_FILL,
		dayMs,
		divergingFill,
		pnlAcross,
		shiftDay,
		weekdayMonthDay,
		weekdayOf
	} from './chart-utils.ts';

	interface Props {
		days: readonly DailyPnl[];
		endDate: string;
		weekStartsOn: 0 | 1;
		currency: string;
		onselect?: (date: string) => void;
	}

	let { days, endDate, weekStartsOn, currency, onselect }: Props = $props();

	const uid = $props.id();
	const hatchId = `${uid}-loss`;

	const GAP = 2;
	const LEFT = 30;
	const TOP = 18;
	/** Touch gets bigger cells (the row scrolls sideways instead): 14px + 2px gap is a 16px pitch. */
	const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
	const MIN_CELL = coarse ? 14 : 10;
	const MAX_CELL = 22;

	let svgEl = $state<SVGSVGElement>();
	let active = $state<string | null>(null);
	let focusedDay = $state<string | null>(null);
	let viewWidth = $state(0);
	let viewHeight = $state(0);
	let scrollLeft = $state(0);

	const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_SHORT = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	const end = $derived(
		/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : new Date().toISOString().slice(0, 10)
	);

	/** First day shown: the start of the week 52 weeks before the end date's week. */
	const start = $derived.by(() => {
		const lead = (weekdayOf(end) - weekStartsOn + 7) % 7;
		return shiftDay(end, -lead - 52 * 7);
	});

	const byDate = $derived(
		new Map(days.filter((d) => d.date >= start && d.date <= end).map((d) => [d.date, d]))
	);
	const maxAbs = $derived([...byDate.values()].reduce((m, d) => Math.max(m, Math.abs(d.pnl)), 0));

	interface Cell {
		readonly date: string;
		readonly col: number;
		readonly row: number;
		readonly data: DailyPnl | null;
	}

	const cells = $derived.by((): Cell[] => {
		const out: Cell[] = [];
		const total = Math.round((dayMs(end) - dayMs(start)) / 86_400_000) + 1;
		for (let i = 0; i < total; i++) {
			const date = shiftDay(start, i);
			out.push({ date, col: Math.floor(i / 7), row: i % 7, data: byDate.get(date) ?? null });
		}
		return out;
	});

	const columnCount = $derived((cells[cells.length - 1]?.col ?? 0) + 1);
	/** Cells grow to fill wide containers and stop at 10px; narrower views scroll instead. */
	const CELL = $derived(
		Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((viewWidth - LEFT) / columnCount) - GAP))
	);
	const STEP = $derived(CELL + GAP);
	const width = $derived(columnCount * STEP);
	const height = $derived(TOP + 7 * STEP);

	const monthLabels = $derived.by(() => {
		const out: { key: string; x: number; label: string }[] = [];
		let lastMonth = '';
		let lastX = -Infinity;
		for (const c of cells) {
			if (c.row !== 0) continue;
			// Label the column where a month's first day falls in the week.
			const week = Array.from({ length: 7 }, (_, r) => shiftDay(c.date, r));
			const firstOfMonth = week.find((d) => d.endsWith('-01') && d <= end);
			const monthKey = (firstOfMonth ?? (c.col === 0 ? c.date : '')).slice(0, 7);
			if (!monthKey || monthKey === lastMonth) continue;
			const x = c.col * STEP;
			if (x - lastX < 30) continue;
			lastMonth = monthKey;
			lastX = x;
			const m = Number(monthKey.slice(5)) - 1;
			const label = m === 0 ? `${MONTH_SHORT[m]} ${monthKey.slice(2, 4)}` : (MONTH_SHORT[m] ?? '');
			out.push({ key: monthKey, x, label });
		}
		return out;
	});

	const rowLabels = $derived(
		[1, 3, 5].map((wd) => ({
			wd,
			row: (wd - weekStartsOn + 7) % 7,
			label: WEEKDAY_SHORT[wd] ?? ''
		}))
	);

	function fillFor(cell: Cell): string {
		if (!cell.data) return 'var(--color-surface-2)';
		if (cell.data.pnl === 0) return FLAT_FILL;
		return divergingFill(cell.data.pnl, maxAbs);
	}

	const actionable = $derived(cells.filter((c) => c.data !== null));
	const tabStop = $derived(focusedDay ?? actionable[actionable.length - 1]?.date ?? null);

	/**
	 * Start scrolled to the most recent weeks. Re-runs when the plot width changes; the resulting
	 * `scroll` event keeps `scrollLeft` (the tooltip anchor offset) in sync.
	 */
	const scrollToLatest: Attachment<HTMLDivElement> = (el) => {
		if (width > 0) el.scrollLeft = el.scrollWidth;
	};

	function focusDate(date: string): void {
		svgEl?.querySelector<SVGElement>(`[data-date="${date}"]`)?.focus();
	}

	function onkeydown(event: KeyboardEvent, date: string): void {
		const map: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
		const delta = map[event.key];
		if (delta !== undefined) {
			event.preventDefault();
			let target = shiftDay(date, delta);
			for (let guard = 0; guard < 400 && target >= start && target <= end; guard++) {
				if (byDate.has(target)) {
					focusDate(target);
					return;
				}
				target = shiftDay(target, Math.sign(delta));
			}
			return;
		}
		if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const target = event.key === 'Home' ? actionable[0] : actionable[actionable.length - 1];
			if (target) focusDate(target.date);
			return;
		}
		if ((event.key === 'Enter' || event.key === ' ') && onselect) {
			event.preventDefault();
			onselect(date);
		}
		if (event.key === 'Escape') active = null;
	}

	const tipDate = $derived(active ?? focusedDay);
	const tipCell = $derived(tipDate ? (cells.find((c) => c.date === tipDate) ?? null) : null);

	const tipAnchor = $derived.by(() => {
		if (!tipCell) return null;
		return {
			x: LEFT + tipCell.col * STEP + CELL - scrollLeft,
			y: TOP + tipCell.row * STEP + CELL / 2
		};
	});

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const d = tipCell?.data;
		if (!d) return [{ label: 'Trades', value: 'None' }];
		return [
			{ label: 'Net P&L', value: formatMoney(d.pnl, { currency, signed: true }) },
			{ label: 'Trades', value: String(d.trades) }
		];
	});

	const total = $derived([...byDate.values()].reduce((s, d) => s + d.pnl, 0));
	const tradeCount = $derived([...byDate.values()].reduce((s, d) => s + d.trades, 0));
	const summary = $derived(
		`Daily P&L heatmap for the 52 weeks ending ${formatDayKey(end, 'long')}: ${byDate.size} trading days, ${pnlAcross(total, tradeCount, currency)}.`
	);

	const tableRows = $derived(
		[...byDate.values()]
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((d): TableRow => ({
				key: d.date,
				cells: [
					formatDayKey(d.date, 'long'),
					formatMoney(d.pnl, { currency, signed: true }),
					String(d.trades)
				]
			}))
	);
</script>

<svelte:window
	onpointerdown={(e) => {
		if (active !== null && !(e.target instanceof Element && e.target.closest('[data-date]')))
			active = null;
	}}
/>

<figure class="heatmap" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	<div class="wrap" bind:clientWidth={viewWidth} bind:clientHeight={viewHeight}>
		<svg class="days" width={LEFT} {height} aria-hidden="true">
			{#each rowLabels as r (r.wd)}
				<text class="label" x={0} y={TOP + r.row * STEP + CELL / 2} dy="0.32em">{r.label}</text>
			{/each}
		</svg>
		<div
			class="scroller"
			data-scroll
			style:margin-left="{LEFT}px"
			{@attach scrollToLatest}
			onscroll={(e) => (scrollLeft = e.currentTarget.scrollLeft)}
		>
			<svg
				bind:this={svgEl}
				{width}
				{height}
				role="group"
				aria-label="Calendar heatmap of daily P&L. Use the arrow keys to move between trading days."
			>
				{#each monthLabels as m (m.key)}
					<text class="label" x={m.x} y={10} aria-hidden="true">{m.label}</text>
				{/each}
				<defs>
					<!-- Loss days carry a 45 degree hatch on top of the hue, so sign never rests on colour alone. -->
					<pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse">
						<path d="M-1 5L5 -1" class="hatch-line" />
					</pattern>
				</defs>
				<g>
					{#each cells as cell (cell.date)}
						{#if cell.data}
							<rect
								class={['cell active', tipDate === cell.date && 'on']}
								role="button"
								tabindex={tabStop === cell.date ? 0 : -1}
								data-date={cell.date}
								aria-label="{weekdayMonthDay(cell.date)}: {pnlAcross(
									cell.data.pnl,
									cell.data.trades,
									currency
								)}"
								x={cell.col * STEP}
								y={TOP + cell.row * STEP}
								width={CELL}
								height={CELL}
								rx={2}
								fill={fillFor(cell)}
								onpointerenter={() => (active = cell.date)}
								onpointerleave={(e) => {
									// Touch fires pointerleave on lift; keep the readout until the next tap elsewhere.
									if (e.pointerType !== 'touch') active = null;
								}}
								onfocus={() => (focusedDay = cell.date)}
								onblur={() => (focusedDay = null)}
								onclick={() => onselect?.(cell.date)}
								onkeydown={(e) => onkeydown(e, cell.date)}
							/>
							{#if cell.data.pnl < 0}
								<rect
									class="hatch"
									x={cell.col * STEP}
									y={TOP + cell.row * STEP}
									width={CELL}
									height={CELL}
									rx={2}
									fill="url(#{hatchId})"
								/>
							{/if}
						{:else}
							<rect
								class="cell"
								x={cell.col * STEP}
								y={TOP + cell.row * STEP}
								width={CELL}
								height={CELL}
								rx={2}
								fill={fillFor(cell)}
							/>
						{/if}
					{/each}
				</g>
			</svg>
		</div>
		{#if tipCell && tipAnchor && tipAnchor.x > 0 && tipAnchor.x < viewWidth}
			<ChartTooltip
				x={tipAnchor.x}
				y={tipAnchor.y}
				boundsWidth={viewWidth}
				boundsHeight={Math.max(viewHeight, 120)}
				title={formatDayKey(tipCell.date, 'long')}
				rows={tooltipRows}
			/>
		{/if}
	</div>
	<p class="key">
		<span class="swatch gain" aria-hidden="true"></span>Gain
		<span class="swatch loss" aria-hidden="true"></span>Loss (hatched)
		<span class="scale">Deeper colour, larger day</span>
	</p>
	<ChartTable
		caption="Daily P&L, last 52 weeks"
		columns={['Day', 'Net P&L', 'Trades']}
		rows={tableRows}
	/>
</figure>

<style>
	.heatmap {
		margin: 0;
		min-width: 0;
	}

	.wrap {
		position: relative;
		width: 100%;
		min-width: 0;
	}

	.days {
		position: absolute;
		left: 0;
		top: 0;
	}

	.scroller {
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x proximity;
		scrollbar-width: thin;
		padding-bottom: var(--space-1);
	}

	svg {
		display: block;
		max-width: none;
		scroll-snap-align: end;
	}

	.label {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
	}

	.cell {
		stroke: none;
	}

	.hatch {
		pointer-events: none;
	}

	.hatch-line {
		stroke: var(--color-ink);
		stroke-opacity: 0.4;
		stroke-width: 1;
		fill: none;
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		margin: var(--space-2) 0 0;
		font-size: var(--text-xs);
		color: var(--color-ink-2);
	}

	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-left: var(--space-2);
		forced-color-adjust: none;
	}

	.swatch:first-child {
		margin-left: 0;
	}

	.swatch.gain {
		background: color-mix(in oklab, var(--color-gain) 45%, var(--color-surface));
	}

	.swatch.loss {
		background:
			repeating-linear-gradient(
				135deg,
				color-mix(in oklab, var(--color-ink) 40%, transparent) 0 1px,
				transparent 1px 4px
			),
			color-mix(in oklab, var(--color-loss) 45%, var(--color-surface));
	}

	.scale {
		margin-left: var(--space-3);
		color: var(--color-ink-3);
	}

	.cell.active {
		cursor: pointer;
		outline: none;
	}

	.cell.on {
		stroke: var(--color-ink-2);
		stroke-width: 1;
	}

	.cell.active:focus-visible {
		stroke: var(--color-focus);
		stroke-width: 2;
	}
</style>
