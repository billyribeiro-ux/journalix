<script lang="ts">
	import type { EquityPoint } from '@strikebook/core';
	import { formatDateTime, formatMoney, formatPercent } from '@strikebook/core';
	import { area, bisector, line, scaleLinear } from 'd3';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import ScrubSurface from './ScrubSurface.svelte';
	import type { AxisTick, TableRow, TooltipRow } from './chart-utils.ts';
	import { compactMoney, textWidth, tickCount } from './chart-utils.ts';

	interface Props {
		points: readonly EquityPoint[];
		startingBalance: number;
		currency: string;
		timeZone: string;
		height?: number;
		xMode?: 'time' | 'trade';
		showDrawdown?: boolean;
	}

	let {
		points,
		startingBalance,
		currency,
		timeZone,
		height = 280,
		xMode = 'time',
		showDrawdown = true
	}: Props = $props();

	const uid = $props.id();
	const clipId = `${uid}-clip`;

	let width = $state(0);
	let active = $state<number | null>(null);

	const DAY = 86_400_000;
	const FONT = 11;

	const mainHeight = $derived(showDrawdown ? Math.round(height * 0.7) : height);
	const ddHeight = $derived(showDrawdown ? height - mainHeight : 0);

	/** x value per point: epoch ms (time mode) or trade number. */
	const xs = $derived(points.map((p) => (xMode === 'time' ? Date.parse(p.at) : p.index)));

	const xDomain = $derived.by((): [number, number] => {
		const first = xs[0];
		const last = xs[xs.length - 1];
		if (first === undefined || last === undefined) return [0, 1];
		if (xMode === 'trade') return first === last ? [first - 0.5, last + 0.5] : [first, last];
		if (last - first < DAY / 24) return [first - DAY / 2, last + DAY / 2];
		return [first, last];
	});

	const yScaleRaw = $derived.by(() => {
		let lo = startingBalance;
		let hi = startingBalance;
		for (const p of points) {
			if (p.equity < lo) lo = p.equity;
			if (p.equity > hi) hi = p.equity;
		}
		const span = hi - lo || Math.max(1, Math.abs(hi) * 0.02);
		return scaleLinear()
			.domain([lo - span * 0.08, hi + span * 0.08])
			.nice(tickCount(mainHeight, 48));
	});

	const yTicksRaw = $derived(yScaleRaw.ticks(tickCount(mainHeight - 24, 44)));
	const yTickLabels = $derived(yTicksRaw.map((t) => compactMoney(t, currency)));

	const ddDomainMin = $derived.by(() => {
		let lo = 0;
		for (const p of points) if (p.drawdownPct < lo) lo = p.drawdownPct;
		return lo < -1e-9 ? lo : -0.01;
	});
	const ddScaleRaw = $derived(scaleLinear().domain([ddDomainMin, 0]).nice(2));
	// The compact panel only needs its two ends: 0% at the top, the deepest nice step below.
	const ddTicksRaw = $derived.by(() => {
		const [lo] = ddScaleRaw.domain() as [number, number];
		return ddHeight > 110 ? ddScaleRaw.ticks(3) : [lo, 0];
	});
	const ddTickLabels = $derived(
		ddTicksRaw.map((t) => formatPercent(t, Math.abs(ddDomainMin) < 0.02 ? 1 : 0))
	);

	const last = $derived(points[points.length - 1]);
	const lastLabel = $derived(last ? compactMoney(last.equity, currency) : '');

	const margin = $derived.by(() => {
		const labels = [...yTickLabels, ...(showDrawdown ? ddTickLabels : [])];
		const widest = labels.reduce((m, l) => Math.max(m, textWidth(l, FONT)), 0);
		return {
			top: 12,
			right: Math.ceil(textWidth(lastLabel, 12) + 14),
			bottom: 24,
			left: Math.ceil(widest + 10)
		};
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const mainInner = $derived(
		Math.max(0, mainHeight - margin.top - (showDrawdown ? 8 : margin.bottom))
	);
	const ddTop = 8;
	const ddInner = $derived(Math.max(0, ddHeight - ddTop - margin.bottom));

	const x = $derived(scaleLinear().domain(xDomain).range([0, innerWidth]));
	const y = $derived(yScaleRaw.copy().range([mainInner, 0]));
	const yDd = $derived(ddScaleRaw.copy().range([ddInner, 0]));

	const px = $derived(xs.map((v) => x(v)));

	const timeShort = $derived(
		new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', year: '2-digit' })
	);

	const xTicks = $derived.by((): AxisTick[] => {
		if (innerWidth <= 0) return [];
		const only = points[0];
		if (points.length === 1 && only) {
			const label =
				xMode === 'trade' ? String(only.index) : formatDateTime(only.at, timeZone, 'short');
			return [{ key: 'only', pos: px[0] ?? 0, label }];
		}
		const count = tickCount(innerWidth, 84);
		if (xMode === 'trade') {
			return x
				.ticks(count)
				.filter((t) => Number.isInteger(t) && t >= 1)
				.map((t) => ({ key: String(t), pos: x(t), label: String(t) }));
		}
		const [d0, d1] = xDomain;
		const spanDays = (d1 - d0) / DAY;
		const step = niceDayStep(spanDays / count);
		const out: AxisTick[] = [];
		const start = Math.ceil(d0 / (step * DAY)) * step * DAY;
		for (let t = start; t <= d1 && out.length < 40; t += step * DAY) {
			const label =
				spanDays > 200 ? timeShort.format(new Date(t)) : formatDateTime(t, timeZone, 'short');
			out.push({ key: String(t), pos: x(t), label });
		}
		return out.filter((tk, i, arr) => i === 0 || tk.label !== arr[i - 1]?.label);
	});

	function niceDayStep(raw: number): number {
		if (raw < 1) return raw < 1 / 24 ? 1 / 24 : raw < 0.25 ? 0.25 : 1;
		for (const s of [1, 2, 7, 14, 30, 61, 91, 182, 365]) if (s >= raw) return s;
		return Math.ceil(raw / 365) * 365;
	}

	const yTicks = $derived(
		yTicksRaw.map((t, i) => ({ key: String(t), pos: y(t), label: yTickLabels[i] ?? '' }))
	);
	const ddTicks = $derived(
		ddTicksRaw.map((t, i) => ({ key: String(t), pos: yDd(t), label: ddTickLabels[i] ?? '' }))
	);

	const baselineY = $derived(y(startingBalance));

	const linePath = $derived(
		line<EquityPoint>()
			.x((_, i) => px[i] ?? 0)
			.y((p) => y(p.equity))(points) ?? ''
	);

	const areaPath = $derived(
		area<EquityPoint>()
			.x((_, i) => px[i] ?? 0)
			.y0(baselineY)
			.y1((p) => y(p.equity))(points) ?? ''
	);

	const ddLinePath = $derived(
		line<EquityPoint>()
			.x((_, i) => px[i] ?? 0)
			.y((p) => yDd(p.drawdownPct))(points) ?? ''
	);

	const ddAreaPath = $derived(
		area<EquityPoint>()
			.x((_, i) => px[i] ?? 0)
			.y0(yDd(0))
			.y1((p) => yDd(p.drawdownPct))(points) ?? ''
	);

	/** Peak-to-trough span of the largest drawdown (by currency, as core reports it). */
	const maxDd = $derived.by(() => {
		let trough = -1;
		let worst = 0;
		points.forEach((p, i) => {
			if (p.drawdown < worst) {
				worst = p.drawdown;
				trough = i;
			}
		});
		const t = points[trough];
		// A drawdown on the very first trade has no plotted peak to span from.
		if (trough <= 0 || !t) return null;
		let peak = -1;
		for (let i = trough - 1; i >= 0; i--) {
			const p = points[i];
			if (p && p.equity >= t.peak - 1e-9) {
				peak = i;
				break;
			}
		}
		// Peak −1 means the starting balance, which sits at the left edge of the plot.
		const x0 = peak >= 0 ? (px[peak] ?? 0) : 0;
		const x1 = px[trough] ?? 0;
		return { x0, x1, amount: t.drawdown, pct: t.drawdownPct, peakIndex: peak, troughIndex: trough };
	});

	const ddLabel = $derived.by(() => {
		if (!maxDd) return null;
		const text = `Max drawdown ${formatPercent(maxDd.pct, 1)}`;
		const w = textWidth(text, FONT);
		const bandW = Math.max(1, maxDd.x1 - maxDd.x0);
		if (w + 8 > innerWidth) return null;
		const centre = maxDd.x0 + bandW / 2;
		const lx = Math.max(0, Math.min(innerWidth - w, centre - w / 2));
		return { text, x: lx };
	});

	const findIndex = bisector<number, number>((d) => d).center;

	function locate(cx: number): number | null {
		if (points.length === 0) return null;
		const i = findIndex(px, cx - margin.left);
		return Math.max(0, Math.min(points.length - 1, i));
	}

	const activePoint = $derived(active === null ? null : (points[active] ?? null));
	const activeX = $derived(active === null ? 0 : (px[active] ?? 0));

	function dateLabel(p: EquityPoint): string {
		return p.at ? formatDateTime(p.at, timeZone, 'datetime') : `Trade ${p.index}`;
	}

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const p = activePoint;
		if (!p) return [];
		return [
			{ label: 'Equity', value: formatMoney(p.equity, { currency }) },
			{ label: 'Trade P&L', value: formatMoney(p.pnl, { currency, signed: true }) },
			{ label: 'Cumulative P&L', value: formatMoney(p.cumulativePnl, { currency, signed: true }) },
			{
				label: 'Drawdown',
				value:
					p.drawdown < 0
						? `${formatMoney(p.drawdown, { currency })} (${formatPercent(p.drawdownPct, 1)})`
						: 'At peak'
			}
		];
	});

	const valueText = $derived.by(() => {
		const p = activePoint ?? last;
		if (!p) return '';
		return `Trade ${p.index}, ${dateLabel(p)}: equity ${formatMoney(p.equity, { currency })}, trade ${formatMoney(p.pnl, { currency, signed: true })}`;
	});

	const summary = $derived.by(() => {
		if (!last) return 'Equity curve with no closed trades in this range.';
		const dd = maxDd ? `, max drawdown ${formatPercent(maxDd.pct, 1)}` : '';
		return `Equity curve from ${formatMoney(startingBalance, { currency })} to ${formatMoney(last.equity, { currency })} over ${points.length} ${points.length === 1 ? 'trade' : 'trades'}${dd}.`;
	});

	const tableRows = $derived(
		points.map((p): TableRow => ({
			key: `${p.tradeId}-${p.index}`,
			cells: [
				String(p.index),
				dateLabel(p),
				formatMoney(p.pnl, { currency, signed: true }),
				formatMoney(p.equity, { currency }),
				formatPercent(p.drawdownPct, 1)
			]
		}))
	);

	const lastY = $derived(last ? y(last.equity) : 0);

	/** "Starting balance" sits at the right end, on the side of the baseline away from the line. */
	const baseLabelY = $derived.by(() => {
		const above = baselineY - 6;
		const below = baselineY + 14;
		// Above the baseline unless the line ends just above it (the label would collide).
		const crowded = lastY < baselineY && baselineY - lastY < 22;
		return crowded && below < mainInner ? below : above;
	});
	const lastX = $derived(px[px.length - 1] ?? 0);
</script>

<figure class="chart" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	{#if points.length === 0}
		<ChartEmpty message="No closed trades in this range" {height} />
	{:else}
		<div class="wrap" bind:clientWidth={width} style:height="{height}px">
			{#if width > 0}
				<svg {width} height={mainHeight} role="img" aria-label="Equity line chart. {summary}">
					<defs>
						<clipPath id={clipId}>
							<rect x={0} y={-2} width={innerWidth} height={mainInner + 4} />
						</clipPath>
					</defs>
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
						{#if !showDrawdown}
							{#each xTicks as tick (tick.key)}
								<text
									class="tick"
									x={tick.pos}
									y={mainInner + 16}
									text-anchor={tick.pos < 24
										? 'start'
										: tick.pos > innerWidth - 24
											? 'end'
											: 'middle'}>{tick.label}</text
								>
							{/each}
						{/if}

						{#if maxDd && maxDd.x1 > maxDd.x0}
							<rect
								class="dd-band"
								x={maxDd.x0}
								y={0}
								width={maxDd.x1 - maxDd.x0}
								height={mainInner}
							/>
						{/if}
						{#if ddLabel}
							<text class="annotation" x={ddLabel.x} y={10}>{ddLabel.text}</text>
						{/if}

						<g clip-path="url(#{clipId})">
							<path class="wash" d={areaPath} />
						</g>
						<line
							class="baseline"
							x1={0}
							x2={innerWidth}
							y1={Math.round(baselineY) + 0.5}
							y2={Math.round(baselineY) + 0.5}
						/>
						<text class="annotation halo" x={innerWidth - 4} y={baseLabelY} text-anchor="end"
							>Starting balance</text
						>
						<path class="equity" d={linePath} />

						{#if points.length === 1 || !activePoint}
							<circle class="marker" cx={lastX} cy={lastY} r={4} />
						{/if}
						<text class="end-label" x={lastX + 8} y={lastY} dy="0.32em">{lastLabel}</text>

						{#if activePoint}
							<line
								class="crosshair"
								x1={Math.round(activeX) + 0.5}
								x2={Math.round(activeX) + 0.5}
								y1={0}
								y2={mainInner}
							/>
							<circle class="marker" cx={activeX} cy={y(activePoint.equity)} r={4} />
						{/if}
					</g>
				</svg>

				{#if showDrawdown}
					<svg
						{width}
						height={ddHeight}
						role="img"
						aria-label="Underwater chart of drawdown from the running peak, sharing the time axis above."
					>
						<g transform="translate({margin.left},{ddTop})">
							{#each ddTicks as tick (tick.key)}
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
							<path class="under" d={ddAreaPath} />
							<path class="under-line" d={ddLinePath} />
							{#if points.length === 1 && !activePoint}
								<circle class="marker loss" cx={lastX} cy={yDd(last?.drawdownPct ?? 0)} r={4} />
							{/if}
							<line class="axis" x1={0} x2={innerWidth} y1={0.5} y2={0.5} />
							<text class="annotation halo" x={4} y={ddInner - 4}>Drawdown</text>
							{#each xTicks as tick (tick.key)}
								<text
									class="tick"
									x={tick.pos}
									y={ddInner + 16}
									text-anchor={tick.pos < 24
										? 'start'
										: tick.pos > innerWidth - 24
											? 'end'
											: 'middle'}>{tick.label}</text
								>
							{/each}
							{#if activePoint}
								<line
									class="crosshair"
									x1={Math.round(activeX) + 0.5}
									x2={Math.round(activeX) + 0.5}
									y1={0}
									y2={ddInner}
								/>
								<circle class="marker loss" cx={activeX} cy={yDd(activePoint.drawdownPct)} r={4} />
							{/if}
						</g>
					</svg>
				{/if}

				<ScrubSurface
					left={0}
					top={margin.top}
					{width}
					height={height - margin.top - margin.bottom}
					label="Equity curve. Use the arrow keys to step through trades."
					count={points.length}
					{active}
					{valueText}
					onactive={(i) => (active = i)}
					locate={(cx) => locate(cx)}
				/>

				{#if activePoint}
					<ChartTooltip
						x={margin.left + activeX}
						y={margin.top + y(activePoint.equity)}
						boundsWidth={width}
						boundsHeight={height}
						title={dateLabel(activePoint)}
						rows={tooltipRows}
					/>
				{/if}
			{/if}
		</div>
		<ChartTable
			caption="Equity by closed trade"
			columns={['Trade', 'Closed', 'Trade P&L', 'Equity', 'Drawdown']}
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

	.axis {
		stroke: var(--chart-axis);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.tick {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.annotation {
		fill: var(--color-ink-3);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.halo {
		paint-order: stroke;
		stroke: var(--color-surface);
		stroke-width: 3px;
		stroke-linejoin: round;
	}

	.end-label {
		fill: var(--color-ink);
		font-size: var(--text-xs);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.baseline {
		stroke: var(--chart-axis);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.dd-band {
		fill: var(--color-loss);
		fill-opacity: 0.06;
	}

	.wash {
		fill: var(--series-1);
		fill-opacity: 0.1;
	}

	.equity {
		fill: none;
		stroke: var(--series-1);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.under {
		fill: var(--color-loss);
		fill-opacity: 0.16;
	}

	.under-line {
		fill: none;
		stroke: var(--color-loss);
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
		stroke-opacity: 0.8;
	}

	.crosshair {
		stroke: var(--chart-crosshair);
		stroke-width: 1;
		shape-rendering: crispEdges;
		pointer-events: none;
	}

	.marker {
		fill: var(--series-1);
		stroke: var(--color-surface);
		stroke-width: 2;
		pointer-events: none;
	}

	.marker.loss {
		fill: var(--color-loss);
	}
</style>
