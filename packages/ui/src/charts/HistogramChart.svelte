<script lang="ts">
	import type { HistogramBin } from '@journalix/core';
	import { formatMoney, formatNumber, formatR } from '@journalix/core';
	import { scaleLinear } from 'd3';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import MarkTargets from './MarkTargets.svelte';
	import type { AxisTick, HitTarget, TableRow, TooltipRow } from './chart-utils.ts';
	import { columnPath, compactMoney, spaceTicks, textWidth, tickCount } from './chart-utils.ts';

	interface Props {
		bins: readonly HistogramBin[];
		unit: 'R' | 'currency';
		currency: string;
		height?: number;
		onselect?: (bin: HistogramBin) => void;
	}

	let { bins, unit, currency, height = 220, onselect }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const FONT = 11;
	const MAX_BAR = 24;

	const sorted = $derived([...bins].sort((a, b) => a.x0 - b.x0));
	const total = $derived(sorted.reduce((s, b) => s + b.count, 0));
	const maxCount = $derived(sorted.reduce((m, b) => Math.max(m, b.count), 0));

	const yRaw = $derived(
		scaleLinear()
			.domain([0, Math.max(1, maxCount)])
			.nice(tickCount(height, 48))
	);
	const yTickValues = $derived(
		yRaw.ticks(tickCount(height - 40, 44)).filter((t) => Number.isInteger(t))
	);

	const margin = $derived({
		top: 10,
		right: 12,
		bottom: 24,
		left: Math.ceil(
			yTickValues.reduce((m, t) => Math.max(m, textWidth(formatNumber(t, 0), FONT)), 0) + 12
		)
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

	const lo = $derived(sorted[0]?.x0 ?? 0);
	const hi = $derived(sorted[sorted.length - 1]?.x1 ?? 1);

	const x = $derived(
		scaleLinear()
			.domain([lo, hi === lo ? lo + 1 : hi])
			.range([0, innerWidth])
	);
	const y = $derived(yRaw.copy().range([innerHeight, 0]));

	function edgeLabel(v: number, digits: number): string {
		return unit === 'R' ? formatR(v, digits) : compactMoney(v, currency);
	}

	function rangeLabel(bin: HistogramBin): string {
		if (unit === 'R') return `${formatR(bin.x0, 1)} to ${formatR(bin.x1, 1)}`;
		return `${formatMoney(bin.x0, { currency, signed: true, digits: 0 })} to ${formatMoney(bin.x1, { currency, signed: true, digits: 0 })}`;
	}

	const bars = $derived(
		sorted.map((bin) => {
			const x0 = x(bin.x0);
			const x1 = x(bin.x1);
			const slot = x1 - x0;
			// Leave a 2px surface gap at minimum and cap the column at 24px.
			const w = Math.max(1, Math.min(MAX_BAR, slot - Math.max(2, slot * 0.2)));
			const cx = x0 + slot / 2;
			const centre = (bin.x0 + bin.x1) / 2;
			return {
				bin,
				key: `${bin.x0}:${bin.x1}`,
				x0,
				slot,
				cx,
				path:
					bin.count > 0 ? columnPath(cx - w / 2, w, y(0), y(bin.count), Math.min(4, w / 2)) : '',
				fill: centre >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
			};
		})
	);

	const xTicks = $derived.by((): AxisTick[] => {
		if (innerWidth <= 0 || sorted.length === 0) return [];
		const sample = edgeLabel(hi, 1);
		const spacing = Math.max(unit === 'R' ? 100 : 72, textWidth(sample, FONT) + 28);
		const ticks = x.ticks(tickCount(innerWidth, spacing));
		const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1;
		const digits = unit === 'R' && step < 1 ? 1 : 0;
		return spaceTicks(
			ticks.map((t) => ({
				key: String(t),
				pos: x(t),
				label: t === 0 ? (unit === 'R' ? '0R' : compactMoney(0, currency)) : edgeLabel(t, digits)
			}))
		);
	});

	const yTicks = $derived(
		yTickValues.map((t): AxisTick => ({ key: String(t), pos: y(t), label: formatNumber(t, 0) }))
	);

	const zeroVisible = $derived(lo < 0 && hi > 0);
	const zeroX = $derived(Math.round(x(0)) + 0.5);

	const targets = $derived(
		bars.map((b): HitTarget => ({
			key: b.key,
			x: margin.left + b.x0,
			y: margin.top,
			w: Math.max(1, b.slot),
			h: innerHeight,
			label: `${rangeLabel(b.bin)}: ${b.bin.count} ${b.bin.count === 1 ? 'trade' : 'trades'}`
		}))
	);

	const activeBar = $derived(active === null ? null : (bars[active] ?? null));

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const b = activeBar?.bin;
		if (!b) return [];
		return [
			{ label: 'Trades', value: formatNumber(b.count, 0) },
			{ label: 'Share', value: total ? `${Math.round((b.count / total) * 100)}%` : '—' }
		];
	});

	const summary = $derived.by(() => {
		if (total === 0)
			return `Distribution of ${unit === 'R' ? 'R-multiples' : 'trade P&L'}, no trades.`;
		const positive = sorted.filter((b) => (b.x0 + b.x1) / 2 >= 0).reduce((s, b) => s + b.count, 0);
		const mode = sorted.reduce((a, b) => (b.count > a.count ? b : a));
		return `Distribution of ${unit === 'R' ? 'R-multiples' : 'trade P&L'} across ${total} trades: ${positive} in gain bins, ${total - positive} in loss bins. Most common range ${rangeLabel(mode)} with ${mode.count}.`;
	});

	const tableRows = $derived(
		sorted.map((b): TableRow => ({
			key: `${b.x0}:${b.x1}`,
			cells: [rangeLabel(b), formatNumber(b.count, 0)]
		}))
	);
</script>

<figure class="chart" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	{#if total === 0}
		<ChartEmpty message="No trades to distribute in this range" {height} />
	{:else}
		<div class="wrap" bind:clientWidth={width} style:height="{height}px">
			{#if width > 0}
				<svg {width} {height} role="img" aria-label="Histogram. {summary}">
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
								text-anchor={tick.pos < 16
									? 'start'
									: tick.pos > innerWidth - 16
										? 'end'
										: 'middle'}>{tick.label}</text
							>
						{/each}
						{#if activeBar}
							<rect
								class="hover-band"
								x={activeBar.x0}
								y={0}
								width={activeBar.slot}
								height={innerHeight}
							/>
						{/if}
						{#each bars as bar (bar.key)}
							{#if bar.path}
								<path d={bar.path} fill={bar.fill} />
							{/if}
						{/each}
						<line
							class="axis"
							x1={0}
							x2={innerWidth}
							y1={Math.round(innerHeight) + 0.5}
							y2={Math.round(innerHeight) + 0.5}
						/>
						{#if zeroVisible}
							<line class="zero" x1={zeroX} x2={zeroX} y1={0} y2={innerHeight} />
						{/if}
					</g>
				</svg>
				<MarkTargets
					{targets}
					label="Histogram bins"
					{active}
					onactive={(i) => (active = i)}
					onpress={onselect
						? (i) => {
								const b = sorted[i];
								if (b) onselect(b);
							}
						: undefined}
					initialIndex={bars.findIndex((b) => b.bin.count === maxCount)}
				/>
				{#if activeBar}
					<ChartTooltip
						x={margin.left + activeBar.cx}
						y={margin.top + y(activeBar.bin.count)}
						boundsWidth={width}
						boundsHeight={height}
						title={rangeLabel(activeBar.bin)}
						rows={tooltipRows}
					/>
				{/if}
			{/if}
		</div>
		<ChartTable caption="Trades per bin" columns={['Range', 'Trades']} rows={tableRows} />
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

	.axis {
		stroke: var(--chart-axis);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.zero {
		stroke: var(--chart-crosshair);
		stroke-opacity: 0.55;
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
</style>
