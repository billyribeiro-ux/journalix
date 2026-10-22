<script lang="ts">
	import { Delaunay, scaleLinear, scaleLog } from 'd3';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartLegend from './ChartLegend.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import ScrubSurface from './ScrubSurface.svelte';
	import type { AxisTick, LegendItem, ScatterPoint, TableRow, TooltipRow } from './chart-utils.ts';
	import { textWidth, tickCount } from './chart-utils.ts';

	interface Props {
		points: readonly ScatterPoint[];
		xLabel: string;
		yLabel: string;
		xFormat: (v: number) => string;
		yFormat: (v: number) => string;
		height?: number;
		xLog?: boolean;
		onselect?: (id: string) => void;
	}

	let {
		points,
		xLabel,
		yLabel,
		xFormat,
		yFormat,
		height = 260,
		xLog = false,
		onselect
	}: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const FONT = 11;
	const R = 4;

	const OUTCOME_FILL: Record<ScatterPoint['outcome'], string> = {
		win: 'var(--color-gain)',
		loss: 'var(--color-loss)',
		breakeven: 'var(--color-neutral)',
		open: 'var(--color-neutral)'
	};

	const OUTCOME_LABEL: Record<ScatterPoint['outcome'], string> = {
		win: 'Win',
		loss: 'Loss',
		breakeven: 'Breakeven',
		open: 'Open'
	};

	/** Log scales cannot show x ≤ 0; those points are left out and noted. */
	const usable = $derived(
		points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!xLog || p.x > 0))
	);
	const dropped = $derived(points.length - usable.length);

	/** Legend key an outcome belongs to (breakeven and open share one entry). */
	const legendKey = (o: ScatterPoint['outcome']): string =>
		o === 'breakeven' || o === 'open' ? 'neutral' : o;

	let hiddenKeys = $state<ReadonlySet<string>>(new Set());
	const visible = $derived(usable.filter((p) => !hiddenKeys.has(legendKey(p.outcome))));

	function toggleKey(key: string): void {
		const next = new Set(hiddenKeys);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		hiddenKeys = next;
		active = null;
	}

	// Draw order: neutral first, then wins, then losses on top — a loss must never hide under a win.
	const RANK: Record<ScatterPoint['outcome'], number> = { open: 0, breakeven: 1, win: 2, loss: 3 };
	const ordered = $derived([...visible].sort((a, b) => RANK[a.outcome] - RANK[b.outcome]));

	const legend = $derived.by((): LegendItem[] => {
		const present = new Set(usable.map((p) => p.outcome));
		const items: LegendItem[] = [];
		if (present.has('win'))
			items.push({ key: 'win', label: 'Win', color: OUTCOME_FILL.win, shape: 'dot' });
		if (present.has('loss'))
			items.push({ key: 'loss', label: 'Loss', color: OUTCOME_FILL.loss, shape: 'diamond' });
		if (present.has('breakeven') || present.has('open')) {
			const label =
				present.has('open') && !present.has('breakeven')
					? 'Open'
					: present.has('open')
						? 'Breakeven or open'
						: 'Breakeven';
			items.push({ key: 'neutral', label, color: 'var(--color-neutral)', shape: 'ring' });
		}
		return items;
	});

	/**
	 * Outcome is carried by shape as well as colour: a win is a disc, a loss a diamond, breakeven or
	 * open a hollow ring, so the chart reads in greyscale and under every colour-vision deficiency.
	 */
	function diamond(cx: number, cy: number, r: number): string {
		const d = r * 1.3;
		return `M${cx},${cy - d}L${cx + d},${cy}L${cx},${cy + d}L${cx - d},${cy}Z`;
	}

	function extent(values: readonly number[]): [number, number] {
		let lo = Infinity;
		let hi = -Infinity;
		for (const v of values) {
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		if (!Number.isFinite(lo)) return [0, 1];
		return [lo, hi];
	}

	const xExtent = $derived(extent(usable.map((p) => p.x)));
	const yExtent = $derived(extent(usable.map((p) => p.y)));

	const yRaw = $derived.by(() => {
		let [lo, hi] = yExtent;
		if (lo === hi) {
			const pad = Math.abs(lo) * 0.1 || 1;
			lo -= pad;
			hi += pad;
		}
		const span = hi - lo;
		return scaleLinear()
			.domain([lo - span * 0.05, hi + span * 0.05])
			.nice(tickCount(height, 48));
	});

	const yTickValues = $derived(yRaw.ticks(tickCount(height - 60, 44)));
	const yLabels = $derived(yTickValues.map((t) => yFormat(t)));

	const margin = $derived({
		top: 18,
		right: 12,
		bottom: 38,
		left: Math.ceil(yLabels.reduce((m, l) => Math.max(m, textWidth(l, FONT)), 0) + 12)
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

	const x = $derived.by(() => {
		let [lo, hi] = xExtent;
		if (xLog) {
			if (lo === hi) {
				lo /= 2;
				hi *= 2;
			}
			return scaleLog()
				.domain([lo / 1.15, hi * 1.15])
				.range([0, innerWidth]);
		}
		if (lo === hi) {
			const pad = Math.abs(lo) * 0.1 || 1;
			lo -= pad;
			hi += pad;
		}
		const span = hi - lo;
		return scaleLinear()
			.domain([lo - span * 0.04, hi + span * 0.04])
			.range([0, innerWidth])
			.nice(tickCount(innerWidth, 80));
	});

	const y = $derived(yRaw.copy().range([innerHeight, 0]));

	const xTicks = $derived.by((): AxisTick[] => {
		if (innerWidth <= 0) return [];
		const sample = xFormat(xExtent[1]);
		const spacing = Math.max(64, textWidth(sample, FONT) + 20);
		const count = tickCount(innerWidth, spacing);
		let ticks = x.ticks(count);
		if (xLog && ticks.length > count) {
			// Log scales return every minor step; keep powers of ten and a few readable minors.
			const majors = ticks.filter((t) => {
				const m = t / 10 ** Math.floor(Math.log10(t) + 1e-9);
				return Math.abs(m - 1) < 1e-6 || Math.abs(m - 2) < 1e-6 || Math.abs(m - 5) < 1e-6;
			});
			ticks =
				majors.length > count
					? majors.filter((t) => Math.abs(t / 10 ** Math.round(Math.log10(t)) - 1) < 1e-6)
					: majors;
		}
		const out: AxisTick[] = [];
		let lastRight = -Infinity;
		for (const t of ticks) {
			const pos = x(t);
			const label = xFormat(t);
			const w = textWidth(label, FONT);
			if (pos - w / 2 < lastRight + 8) continue;
			lastRight = pos + w / 2;
			out.push({ key: String(t), pos, label });
		}
		return out;
	});

	const yTicks = $derived(
		yTickValues.map((t, i): AxisTick => ({ key: String(t), pos: y(t), label: yLabels[i] ?? '' }))
	);

	const spansZero = $derived.by(() => {
		const [lo = 0, hi = 0] = yRaw.domain();
		return lo < 0 && hi > 0;
	});

	const plotted = $derived(ordered.map((p) => ({ p, cx: x(p.x), cy: y(p.y) })));

	const delaunay = $derived(
		Delaunay.from(
			plotted,
			(d) => d.cx,
			(d) => d.cy
		)
	);

	function locate(px: number, py: number): number | null {
		if (plotted.length === 0) return null;
		const i = delaunay.find(px, py);
		const d = plotted[i];
		if (!d) return null;
		return Math.hypot(d.cx - px, d.cy - py) <= 40 ? i : null;
	}

	/** Keyboard order runs left to right by x so arrow keys feel spatial. */
	const keyOrder = $derived(
		plotted.map((_, i) => i).sort((a, b) => (plotted[a]?.cx ?? 0) - (plotted[b]?.cx ?? 0))
	);
	const keyRank = $derived.by(() => {
		const rank = new Array<number>(keyOrder.length);
		keyOrder.forEach((idx, r) => (rank[idx] = r));
		return rank;
	});

	const activePlotted = $derived(active === null ? null : (plotted[active] ?? null));

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const d = activePlotted;
		if (!d) return [];
		return [
			{ label: xLabel, value: xFormat(d.p.x) },
			{ label: yLabel, value: yFormat(d.p.y) },
			{ label: 'Outcome', value: OUTCOME_LABEL[d.p.outcome], swatch: OUTCOME_FILL[d.p.outcome] }
		];
	});

	const valueText = $derived.by(() => {
		const d = activePlotted;
		if (!d) return '';
		return `${d.p.label}: ${xLabel} ${xFormat(d.p.x)}, ${yLabel} ${yFormat(d.p.y)}, ${OUTCOME_LABEL[d.p.outcome]}`;
	});

	const summary = $derived.by(() => {
		if (usable.length === 0) return `Scatter plot of ${yLabel} against ${xLabel}, no points.`;
		const wins = usable.filter((p) => p.outcome === 'win').length;
		const losses = usable.filter((p) => p.outcome === 'loss').length;
		return `Scatter plot of ${yLabel} against ${xLabel} for ${usable.length} trades: ${wins} wins, ${losses} losses.${dropped ? ` ${dropped} points with no positive ${xLabel} are not shown on the log scale.` : ''}`;
	});

	const tableRows = $derived(
		usable.map((p): TableRow => ({
			key: p.id,
			cells: [p.label, xFormat(p.x), yFormat(p.y), OUTCOME_LABEL[p.outcome]]
		}))
	);

	function onactive(i: number | null): void {
		active = i;
	}

	/** ScrubSurface steps by index; translate through the spatial key order. */
	function onscrub(i: number | null): void {
		active = i === null ? null : (keyOrder[i] ?? null);
	}
</script>

<figure class="chart" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	{#if usable.length === 0}
		<ChartEmpty message="No trades to plot in this range" {height} />
	{:else}
		<ChartLegend items={legend} hidden={hiddenKeys} ontoggle={toggleKey} />
		<div class="wrap" bind:clientWidth={width} style:height="{height}px">
			{#if width > 0}
				<svg data-wipe {width} {height} role="img" aria-label="Scatter plot. {summary}">
					<text class="axis-title" x={margin.left} y={10}>{yLabel}</text>
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
							<line
								class="grid"
								x1={Math.round(tick.pos) + 0.5}
								x2={Math.round(tick.pos) + 0.5}
								y1={0}
								y2={innerHeight}
							/>
							<text class="tick" x={tick.pos} y={innerHeight + 16} text-anchor="middle"
								>{tick.label}</text
							>
						{/each}
						{#if spansZero}
							<line
								class="zero"
								x1={0}
								x2={innerWidth}
								y1={Math.round(y(0)) + 0.5}
								y2={Math.round(y(0)) + 0.5}
							/>
						{/if}
						<text class="axis-title" x={innerWidth} y={innerHeight + 32} text-anchor="end"
							>{xLabel}</text
						>
						{#each plotted as d (d.p.id)}
							{#if d.p.outcome === 'loss'}
								<path class="dot" d={diamond(d.cx, d.cy, R)} fill={OUTCOME_FILL.loss} />
							{:else if d.p.outcome === 'win'}
								<circle class="dot" cx={d.cx} cy={d.cy} r={R} fill={OUTCOME_FILL.win} />
							{:else}
								<circle class="dot ring" cx={d.cx} cy={d.cy} r={R - 0.5} />
							{/if}
						{/each}
						{#if activePlotted}
							<line
								class="crosshair"
								x1={activePlotted.cx}
								x2={activePlotted.cx}
								y1={activePlotted.cy + 8}
								y2={innerHeight}
							/>
							{#if activePlotted.p.outcome === 'loss'}
								<path
									class="dot active"
									d={diamond(activePlotted.cx, activePlotted.cy, R + 2)}
									fill={OUTCOME_FILL.loss}
								/>
							{:else if activePlotted.p.outcome === 'win'}
								<circle
									class="dot active"
									cx={activePlotted.cx}
									cy={activePlotted.cy}
									r={R + 2}
									fill={OUTCOME_FILL.win}
								/>
							{:else}
								<circle
									class="dot active ring"
									cx={activePlotted.cx}
									cy={activePlotted.cy}
									r={R + 1.5}
								/>
							{/if}
						{/if}
					</g>
				</svg>
				<ScrubSurface
					left={margin.left}
					top={margin.top}
					width={innerWidth}
					height={innerHeight}
					label="{yLabel} against {xLabel}. Use the arrow keys to step through trades from left to right."
					count={plotted.length}
					active={active === null ? null : (keyRank[active] ?? null)}
					{valueText}
					onactive={(i) => (i === null ? onactive(null) : onscrub(i))}
					locate={(px, py) => {
						const i = locate(px, py);
						return i === null ? null : (keyRank[i] ?? null);
					}}
					onpress={onselect
						? (r) => {
								const d = plotted[keyOrder[r] ?? -1];
								if (d) onselect(d.p.id);
							}
						: undefined}
				/>
				{#if activePlotted}
					<ChartTooltip
						x={margin.left + activePlotted.cx}
						y={margin.top + activePlotted.cy}
						boundsWidth={width}
						boundsHeight={height}
						title={activePlotted.p.label}
						rows={tooltipRows}
					/>
				{/if}
			{/if}
		</div>
		{#if dropped > 0}
			<p class="footnote">
				{dropped}
				{dropped === 1 ? 'point is' : 'points are'} not shown because the log scale needs positive values.
			</p>
		{/if}
		<ChartTable
			caption="{yLabel} against {xLabel}"
			columns={['Trade', xLabel, yLabel, 'Outcome']}
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

	.crosshair {
		stroke: var(--chart-crosshair);
		stroke-opacity: 0.5;
		stroke-width: 1;
	}

	.tick {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.axis-title {
		fill: var(--color-ink-3);
		font-size: var(--text-2xs);
	}

	.dot {
		stroke: var(--color-surface);
		stroke-width: 2;
	}

	.dot.active {
		stroke-width: 2;
	}

	/* Hollow marker: a surface-filled disc with a neutral outline. */
	.dot.ring {
		fill: var(--color-surface);
		stroke: var(--color-neutral);
		stroke-width: 2;
	}

	.footnote {
		margin-top: var(--space-1);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}
</style>
