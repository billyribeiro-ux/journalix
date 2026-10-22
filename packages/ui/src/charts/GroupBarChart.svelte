<script lang="ts">
	import type { GroupStats } from '@journalix/core';
	import { formatMoney, formatNumber, formatPercent, formatR, formatRatio } from '@journalix/core';
	import { scaleLinear } from 'd3';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import MarkTargets from './MarkTargets.svelte';
	import type { AxisTick, GroupMetric, HitTarget, TableRow, TooltipRow } from './chart-utils.ts';
	import {
		compactMoney,
		compactSignedMoney,
		rowBarPath,
		spaceTicks,
		textWidth,
		tickCount
	} from './chart-utils.ts';

	interface Props {
		rows: readonly GroupStats[];
		metric: GroupMetric;
		currency: string;
		height?: number;
		maxRows?: number;
	}

	let { rows, metric, currency, height, maxRows = 12 }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const FONT = 11;
	const ROW = 32;
	const BAR = 16;

	const METRIC_LABEL: Record<GroupMetric, string> = {
		netPnl: 'Net P&L',
		winRate: 'Win rate',
		averageR: 'Average R',
		averagePnl: 'Average P&L',
		profitFactor: 'Profit factor',
		trades: 'Trades'
	};

	const signed = $derived(metric === 'netPnl' || metric === 'averagePnl' || metric === 'averageR');
	const additive = $derived(metric === 'netPnl' || metric === 'trades');

	function valueOf(row: GroupStats): number | null {
		switch (metric) {
			case 'netPnl':
				return row.netPnl;
			case 'winRate':
				return row.winRate;
			case 'averageR':
				return row.averageR;
			case 'averagePnl':
				return row.averagePnl;
			case 'profitFactor':
				return row.profitFactor;
			case 'trades':
				return row.trades;
		}
	}

	function format(value: number | null, compact: boolean): string {
		if (value === null) return metric === 'profitFactor' ? 'No losses' : '—';
		switch (metric) {
			case 'netPnl':
			case 'averagePnl':
				return compact
					? compactSignedMoney(value, currency)
					: formatMoney(value, { currency, signed: true });
			case 'winRate':
				return formatPercent(value, 0);
			case 'averageR':
				return formatR(value, 2);
			case 'profitFactor':
				return formatRatio(value, 2);
			case 'trades':
				return formatNumber(value, 0);
		}
	}

	function foldOther(tail: readonly GroupStats[]): GroupStats {
		const trades = tail.reduce((s, r) => s + r.trades, 0);
		const wins = tail.reduce((s, r) => s + r.wins, 0);
		const losses = tail.reduce((s, r) => s + r.losses, 0);
		const netPnl = tail.reduce((s, r) => s + r.netPnl, 0);
		const grossProfit = tail.reduce((s, r) => s + r.grossProfit, 0);
		const grossLoss = tail.reduce((s, r) => s + r.grossLoss, 0);
		const rWeighted = tail.filter((r) => r.averageR !== null);
		const rTrades = rWeighted.reduce((s, r) => s + r.trades, 0);
		return {
			key: '__other__',
			label: `Other (${tail.length})`,
			order: Number.MAX_SAFE_INTEGER,
			trades,
			wins,
			losses,
			winRate: wins + losses ? wins / (wins + losses) : null,
			netPnl,
			averagePnl: trades ? netPnl / trades : 0,
			profitFactor: grossLoss < 0 ? grossProfit / Math.abs(grossLoss) : null,
			averageR: rTrades
				? rWeighted.reduce((s, r) => s + (r.averageR ?? 0) * r.trades, 0) / rTrades
				: null,
			grossProfit,
			grossLoss
		};
	}

	const shown = $derived.by(() => {
		const limit = Math.max(1, maxRows);
		if (rows.length <= limit) return { list: [...rows], hidden: 0, folded: false };
		if (additive && limit >= 2) {
			// Keep the groups with the largest effect — big losers as well as big winners — in their
			// original order, and fold only the smallest ones into Other.
			const keep = new Set(
				rows
					.map((row, index) => ({ index, size: Math.abs(valueOf(row) ?? 0) }))
					.sort((a, b) => b.size - a.size)
					.slice(0, limit - 1)
					.map((r) => r.index)
			);
			const head = rows.filter((_, index) => keep.has(index));
			return {
				list: [...head, foldOther(rows.filter((_, index) => !keep.has(index)))],
				hidden: rows.length - head.length,
				folded: true
			};
		}
		return { list: rows.slice(0, limit), hidden: rows.length - limit, folded: false };
	});

	const list = $derived(shown.list);
	/** Below 420px each label sits above its bar so the bars keep the full width. */
	const stacked = $derived(width > 0 && width < 420);
	const LABEL_H = 16;
	const chartHeight = $derived(
		height ?? Math.max(120, list.length * (stacked ? ROW + LABEL_H : ROW) + 28)
	);

	const values = $derived(list.map(valueOf));
	const valueLabels = $derived(values.map((v) => format(v, true)));

	const domain = $derived.by((): [number, number] => {
		if (metric === 'winRate') return [0, 1];
		let lo = 0;
		let hi = 0;
		for (const v of values) {
			if (v === null) continue;
			lo = Math.min(lo, v);
			hi = Math.max(hi, v);
		}
		if (lo === 0 && hi === 0) hi = 1;
		return [lo, hi];
	});

	const labelColumn = $derived(stacked ? 0 : Math.min(180, width * 0.24));
	const valueRoom = $derived(
		Math.ceil(valueLabels.reduce((m, l) => Math.max(m, textWidth(l, FONT)), 0) + 10)
	);
	const hasNegative = $derived(domain[0] < 0);

	const margin = $derived({
		top: 4,
		right: valueRoom,
		bottom: 22,
		left: labelColumn + (hasNegative ? valueRoom : stacked ? 2 : 8)
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, chartHeight - margin.top - margin.bottom));
	const rowStep = $derived(list.length ? innerHeight / list.length : innerHeight);
	const labelBand = $derived(stacked ? LABEL_H : 0);
	const barH = $derived(Math.max(4, Math.min(BAR, rowStep - labelBand - 8, 24)));

	const x = $derived.by(() => {
		const s = scaleLinear().domain(domain).range([0, innerWidth]);
		return metric === 'winRate' ? s : s.nice(tickCount(innerWidth, 90));
	});

	const xTicks = $derived(
		spaceTicks(
			x
				.ticks(tickCount(innerWidth, metric === 'netPnl' || metric === 'averagePnl' ? 90 : 70))
				.map((t): AxisTick => ({
					key: String(t),
					pos: x(t),
					label:
						metric === 'winRate'
							? formatPercent(t, 0)
							: metric === 'netPnl' || metric === 'averagePnl'
								? compactMoney(t, currency)
								: metric === 'averageR'
									? formatR(t, Number.isInteger(t) ? 0 : 1)
									: formatNumber(t, Number.isInteger(t) ? 0 : 1)
				}))
		)
	);

	const zeroX = $derived(Math.round(x(0)) + 0.5);

	function fillFor(v: number | null): string {
		if (v === null) return 'var(--color-neutral)';
		if (!signed) return 'var(--series-1)';
		return v > 0 ? 'var(--color-gain)' : v < 0 ? 'var(--color-loss)' : 'var(--color-neutral)';
	}

	const bars = $derived(
		list.map((row, i) => {
			const v = values[i] ?? null;
			const cy = stacked ? rowStep * i + labelBand + 2 + barH / 2 : rowStep * i + rowStep / 2;
			const xEnd = v === null ? x(0) : x(v);
			const label = valueLabels[i] ?? '';
			const negative = v !== null && v < 0;
			return {
				row,
				value: v,
				top: rowStep * i,
				cy,
				path: v === null ? '' : rowBarPath(cy - barH / 2, barH, x(0), xEnd),
				fill: fillFor(v),
				label,
				labelX: negative ? xEnd - 6 : xEnd + 6,
				anchor: negative ? ('end' as const) : ('start' as const)
			};
		})
	);

	const targets = $derived(
		bars.map((b): HitTarget => ({
			key: b.row.key,
			x: 0,
			y: margin.top + b.top,
			w: width,
			h: rowStep,
			label: `${b.row.label}: ${METRIC_LABEL[metric]} ${format(b.value, false)}, ${b.row.trades} trades, win rate ${formatPercent(b.row.winRate, 0)}, net ${formatMoney(b.row.netPnl, { currency, signed: true })}`
		}))
	);

	const activeBar = $derived(active === null ? null : (bars[active] ?? null));

	function statsRows(row: GroupStats): TooltipRow[] {
		return [
			{ label: 'Trades', value: formatNumber(row.trades, 0) },
			{ label: 'Win rate', value: formatPercent(row.winRate, 0) },
			{ label: 'Net P&L', value: formatMoney(row.netPnl, { currency, signed: true }) },
			{
				label: 'Profit factor',
				value:
					row.profitFactor === null
						? row.grossProfit > 0
							? 'No losses'
							: '—'
						: formatRatio(row.profitFactor, 2)
			},
			{ label: 'Average R', value: formatR(row.averageR, 2) }
		];
	}

	const footnote = $derived.by(() => {
		if (shown.hidden === 0) return '';
		if (shown.folded) return `The ${shown.hidden} smallest groups are combined into Other.`;
		return `Showing ${list.length} of ${rows.length} groups.`;
	});

	const summary = $derived.by(() => {
		if (list.length === 0) return `${METRIC_LABEL[metric]} by group, no data.`;
		const top = bars.reduce((a, b) => ((b.value ?? -Infinity) > (a.value ?? -Infinity) ? b : a));
		return `${METRIC_LABEL[metric]} by group for ${list.length} groups. Highest: ${top.row.label} at ${format(top.value, false)}.${footnote ? ` ${footnote}` : ''}`;
	});

	const tableRows = $derived(
		list.map((row): TableRow => ({
			key: row.key,
			cells: [
				row.label,
				formatNumber(row.trades, 0),
				formatPercent(row.winRate, 0),
				formatMoney(row.netPnl, { currency, signed: true }),
				formatMoney(row.averagePnl, { currency, signed: true }),
				formatRatio(row.profitFactor, 2),
				formatR(row.averageR, 2)
			]
		}))
	);
</script>

<figure class="chart" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	{#if list.length === 0}
		<ChartEmpty message="No trades to group in this range" height={chartHeight} />
	{:else}
		<div class="wrap" bind:clientWidth={width} style:height="{chartHeight}px">
			{#if width > 0}
				<svg
					data-wipe
					{width}
					height={chartHeight}
					role="img"
					aria-label="Horizontal bar chart. {summary}"
				>
					<g transform="translate({margin.left},{margin.top})">
						{#each xTicks as tick (tick.key)}
							<line
								class="grid"
								x1={Math.round(tick.pos) + 0.5}
								x2={Math.round(tick.pos) + 0.5}
								y1={0}
								y2={innerHeight}
							/>
							<text class="tick" x={tick.pos} y={innerHeight + 15} text-anchor="middle"
								>{tick.label}</text
							>
						{/each}
						{#if metric === 'winRate'}
							<line
								class="reference"
								x1={Math.round(x(0.5)) + 0.5}
								x2={Math.round(x(0.5)) + 0.5}
								y1={0}
								y2={innerHeight}
							/>
						{/if}
						{#if activeBar}
							<rect
								class="hover-band"
								x={-margin.left}
								y={activeBar.top}
								{width}
								height={rowStep}
							/>
						{/if}
						{#each bars as bar (bar.row.key)}
							{#if bar.path}
								<path d={bar.path} fill={bar.fill} />
							{/if}
							<text
								class="value"
								x={bar.value === null ? zeroX + 6 : bar.labelX}
								y={bar.cy}
								dy="0.32em"
								text-anchor={bar.value === null ? 'start' : bar.anchor}>{bar.label}</text
							>
						{/each}
						<line class="zero" x1={zeroX} x2={zeroX} y1={0} y2={innerHeight} />
					</g>
				</svg>
				<ul
					class={['labels', stacked && 'stacked']}
					role="list"
					aria-hidden="true"
					style:width={stacked ? '100%' : `${labelColumn}px`}
					style:top="{margin.top}px"
					style:height="{innerHeight}px"
				>
					{#each bars as bar (bar.row.key)}
						<li
							style:height="{rowStep}px"
							style:line-height={stacked ? `${LABEL_H + 4}px` : `${rowStep}px`}
							title={bar.row.label}
						>
							{bar.row.label}
						</li>
					{/each}
				</ul>
				<MarkTargets
					{targets}
					label="{METRIC_LABEL[metric]} by group"
					{active}
					onactive={(i) => (active = i)}
				/>
				{#if activeBar}
					<ChartTooltip
						x={margin.left + Math.max(x(0), activeBar.value === null ? x(0) : x(activeBar.value))}
						y={margin.top + activeBar.cy}
						boundsWidth={width}
						boundsHeight={chartHeight}
						title={activeBar.row.label}
						rows={statsRows(activeBar.row)}
					/>
				{/if}
			{/if}
		</div>
		{#if footnote}
			<p class="footnote">{footnote}</p>
		{/if}
		<ChartTable
			caption="Performance by group"
			columns={[
				'Group',
				'Trades',
				'Win rate',
				'Net P&L',
				'Average P&L',
				'Profit factor',
				'Average R'
			]}
			rows={tableRows}
		/>
	{/if}
</figure>

<style>
	.chart {
		margin: 0;
		min-width: 0;
	}

	.wrap {
		position: relative;
		width: 100%;
		min-width: 0;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.labels {
		position: absolute;
		left: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		pointer-events: none;
	}

	.labels li {
		display: block;
		min-width: 0;
		padding-right: var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.grid {
		stroke: var(--chart-grid);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.zero {
		stroke: var(--chart-baseline);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.reference {
		stroke: var(--chart-crosshair);
		stroke-opacity: 0.5;
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.tick {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.value {
		fill: var(--color-ink-2);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.hover-band {
		fill: var(--color-ink);
		fill-opacity: 0.04;
	}

	.footnote {
		margin-top: var(--space-1);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}
</style>
