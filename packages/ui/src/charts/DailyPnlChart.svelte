<script lang="ts">
	import type { DailyPnl } from '@journalix/core';
	import { formatDayKey, formatMoney } from '@journalix/core';
	import { scaleBand, scaleLinear } from 'd3';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import MarkTargets from './MarkTargets.svelte';
	import type { AxisTick, HitTarget, TableRow, TooltipRow } from './chart-utils.ts';
	import {
		columnPath,
		moneyTickLabels,
		domainWithZero,
		pnlAcross,
		textWidth,
		thinLabels,
		tickCount
	} from './chart-utils.ts';

	interface Props {
		days: readonly DailyPnl[];
		currency: string;
		height?: number;
	}

	let { days, currency, height = 220 }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const FONT = 11;
	const MAX_BAR = 24;
	const GAP = 2;

	const sorted = $derived([...days].sort((a, b) => a.date.localeCompare(b.date)));

	const yRaw = $derived(
		scaleLinear()
			.domain(domainWithZero(sorted.map((d) => d.pnl)))
			.nice(tickCount(height, 48))
	);
	const yTickValues = $derived(yRaw.ticks(tickCount(height - 40, 44)));
	const yLabels = $derived(moneyTickLabels(yTickValues, currency));

	const margin = $derived({
		top: 10,
		right: 8,
		bottom: 24,
		left: Math.ceil(yLabels.reduce((m, l) => Math.max(m, textWidth(l, FONT)), 0) + 10)
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

	const band = $derived.by(() => {
		const domain = sorted.map((d) => d.date);
		const b = scaleBand<string>().domain(domain).range([0, innerWidth]);
		// Padding sized so neighbouring bars keep at least a 2px surface gap.
		const step = domain.length ? innerWidth / domain.length : innerWidth;
		const padding = step > 0 ? Math.min(0.5, Math.max(GAP / step, 0.2)) : 0.2;
		return b.paddingInner(padding).paddingOuter(padding / 2);
	});

	const barWidth = $derived(Math.max(1, Math.min(MAX_BAR, band.bandwidth())));
	const y = $derived(yRaw.copy().range([innerHeight, 0]));
	const zeroY = $derived(Math.round(y(0)) + 0.5);

	const bars = $derived(
		sorted.map((d) => {
			const centre = (band(d.date) ?? 0) + band.bandwidth() / 2;
			const x = centre - barWidth / 2;
			return {
				day: d,
				x,
				centre,
				path: columnPath(x, barWidth, y(0), y(d.pnl), Math.min(4, barWidth / 2)),
				fill:
					d.pnl > 0 ? 'var(--color-gain)' : d.pnl < 0 ? 'var(--color-loss)' : 'var(--color-neutral)'
			};
		})
	);

	const yTicks = $derived(
		yTickValues.map((t, i): AxisTick => ({ key: String(t), pos: y(t), label: yLabels[i] ?? '' }))
	);

	const xTicks = $derived.by((): AxisTick[] => {
		if (bars.length === 0 || innerWidth <= 0) return [];
		const label = (d: string): string => formatDayKey(d, 'short');
		const room = textWidth('Sep 30', FONT) + 16;
		const picked = thinLabels(bars, Math.max(1, Math.floor(innerWidth / room)));
		return picked.map((b) => ({ key: b.day.date, pos: b.centre, label: label(b.day.date) }));
	});

	const targets = $derived(
		bars.map((b): HitTarget => ({
			key: b.day.date,
			x: margin.left + (band(b.day.date) ?? 0) - (band.step() * band.paddingInner()) / 2,
			y: margin.top,
			w: band.step(),
			h: innerHeight,
			label: `${formatDayKey(b.day.date, 'long')}: ${pnlAcross(b.day.pnl, b.day.trades, currency)}`
		}))
	);

	const activeBar = $derived(active === null ? null : (bars[active] ?? null));

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const d = activeBar?.day;
		if (!d) return [];
		return [
			{ label: 'Net P&L', value: formatMoney(d.pnl, { currency, signed: true }) },
			{ label: 'Trades', value: String(d.trades) },
			{ label: 'Wins', value: String(d.wins) },
			{ label: 'Losses', value: String(d.losses) }
		];
	});

	const summary = $derived.by(() => {
		if (sorted.length === 0) return 'Daily P&L chart with no trading days in this range.';
		const green = sorted.filter((d) => d.pnl > 0).length;
		const red = sorted.filter((d) => d.pnl < 0).length;
		const best = sorted.reduce((a, d) => (d.pnl > a.pnl ? d : a));
		const worst = sorted.reduce((a, d) => (d.pnl < a.pnl ? d : a));
		return `Daily net P&L over ${sorted.length} trading days: ${green} green, ${red} red. Best ${formatMoney(best.pnl, { currency, signed: true })} on ${formatDayKey(best.date)}, worst ${formatMoney(worst.pnl, { currency, signed: true })} on ${formatDayKey(worst.date)}.`;
	});

	const tableRows = $derived(
		sorted.map((d): TableRow => ({
			key: d.date,
			cells: [
				formatDayKey(d.date, 'long'),
				formatMoney(d.pnl, { currency, signed: true }),
				String(d.trades),
				String(d.wins),
				String(d.losses)
			]
		}))
	);
</script>

<figure class="chart" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	{#if sorted.length === 0}
		<ChartEmpty message="No trading days in this range" {height} />
	{:else}
		<div class="wrap" bind:clientWidth={width} style:height="{height}px">
			{#if width > 0}
				<svg
					data-wipe
					{width}
					{height}
					role="img"
					aria-label="Column chart of daily net P&L. {summary}"
				>
					<g transform="translate({margin.left},{margin.top})">
						{#each yTicks as tick (tick.key)}
							<line
								class="grid"
								x1={0}
								x2={innerWidth}
								y1={Math.round(tick.pos) + 0.5}
								y2={Math.round(tick.pos) + 0.5}
							/>
							<text class="tick" x={-8} y={tick.pos} dy="0.32em" text-anchor="end"
								>{tick.label}</text
							>
						{/each}
						{#each xTicks as tick (tick.key)}
							<text
								class="tick"
								x={tick.pos}
								y={innerHeight + 16}
								text-anchor={tick.pos < 20
									? 'start'
									: tick.pos > innerWidth - 20
										? 'end'
										: 'middle'}>{tick.label}</text
							>
						{/each}
						{#if activeBar}
							<rect
								class="hover-band"
								x={activeBar.centre - band.step() / 2}
								y={0}
								width={band.step()}
								height={innerHeight}
							/>
						{/if}
						{#each bars as bar, i (bar.day.date)}
							<path
								d={bar.path}
								fill={bar.fill}
								class={['bar', active !== null && active !== i && 'dim']}
							/>
						{/each}
						<line class="zero" x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} />
					</g>
				</svg>
				<MarkTargets
					{targets}
					label="Trading days"
					{active}
					onactive={(i) => (active = i)}
					initialIndex={bars.length - 1}
				/>
				{#if activeBar}
					<ChartTooltip
						x={margin.left + activeBar.centre}
						y={margin.top + Math.min(y(0), y(activeBar.day.pnl))}
						boundsWidth={width}
						boundsHeight={height}
						title={formatDayKey(activeBar.day.date, 'long')}
						rows={tooltipRows}
					/>
				{/if}
			{/if}
		</div>
		<ChartTable
			caption="Daily net P&L"
			columns={['Day', 'Net P&L', 'Trades', 'Wins', 'Losses']}
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

	.tick {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.hover-band {
		fill: var(--color-ink);
		fill-opacity: 0.04;
	}

	.bar {
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.bar.dim {
		opacity: 0.55;
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
