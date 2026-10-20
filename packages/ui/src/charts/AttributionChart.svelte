<script lang="ts">
	import type { PnlAttribution } from '@strikebook/core';
	import { formatMoney, formatNumber, formatPercent } from '@strikebook/core';
	import { scaleBand, scaleLinear } from 'd3';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import MarkTargets from './MarkTargets.svelte';
	import type { AxisTick, HitTarget, TableRow, TooltipRow } from './chart-utils.ts';
	import {
		columnPath,
		compactMoney,
		compactSignedMoney,
		roundedRectPath,
		textWidth,
		tickCount
	} from './chart-utils.ts';

	interface Props {
		attribution: PnlAttribution;
		currency: string;
		height?: number;
	}

	let { attribution, currency, height = 220 }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const FONT = 11;
	const MAX_BAR = 24;

	interface Step {
		readonly key: string;
		readonly label: string;
		readonly value: number;
		readonly start: number;
		readonly end: number;
		readonly total: boolean;
		readonly note: string;
	}

	const steps = $derived.by((): Step[] => {
		const a = attribution;
		const parts: { key: string; label: string; value: number; note: string }[] = [
			{
				key: 'delta',
				label: 'Delta',
				value: a.delta,
				note: `Underlying moved ${formatMoney(a.underlyingMove, { currency, signed: true })}`
			},
			{ key: 'gamma', label: 'Gamma', value: a.gamma, note: 'Curvature of the move' },
			{
				key: 'theta',
				label: 'Theta',
				value: a.theta,
				note: `${formatNumber(a.days, 1)} days held`
			},
			{
				key: 'vega',
				label: 'Vega',
				value: a.vega,
				note: `IV changed ${formatPercent(a.ivChange, 1, true)}`
			},
			{
				key: 'residual',
				label: 'Residual',
				value: a.residual,
				note: 'Higher-order terms, path and fills'
			}
		];
		let running = 0;
		const out: Step[] = parts.map((p) => {
			const start = running;
			running += p.value;
			return { ...p, start, end: running, total: false };
		});
		out.push({
			key: 'total',
			label: 'Total',
			value: a.actual,
			start: 0,
			end: a.actual,
			total: true,
			note: 'Actual gross P&L'
		});
		return out;
	});

	const yRaw = $derived.by(() => {
		let lo = 0;
		let hi = 0;
		for (const s of steps) {
			lo = Math.min(lo, s.start, s.end);
			hi = Math.max(hi, s.start, s.end);
		}
		if (lo === hi) hi = 1;
		const span = hi - lo;
		return scaleLinear()
			.domain([lo < 0 ? lo - span * 0.12 : 0, hi > 0 ? hi + span * 0.12 : 0])
			.nice(tickCount(height, 50));
	});

	const yTickValues = $derived(yRaw.ticks(tickCount(height - 50, 44)));
	const yLabels = $derived(yTickValues.map((t) => compactMoney(t, currency)));

	const margin = $derived({
		top: 14,
		right: 8,
		bottom: 24,
		left: Math.ceil(yLabels.reduce((m, l) => Math.max(m, textWidth(l, FONT)), 0) + 10)
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

	const band = $derived(
		scaleBand<string>()
			.domain(steps.map((s) => s.key))
			.range([0, innerWidth])
			.paddingInner(0.35)
			.paddingOuter(0.2)
	);
	const barW = $derived(Math.max(4, Math.min(MAX_BAR, band.bandwidth())));
	const y = $derived(yRaw.copy().range([innerHeight, 0]));
	const zeroY = $derived(Math.round(y(0)) + 0.5);

	const bars = $derived(
		steps.map((s) => {
			const cx = (band(s.key) ?? 0) + band.bandwidth() / 2;
			const x = cx - barW / 2;
			const y0 = y(s.start);
			const y1 = y(s.end);
			const up = s.end >= s.start;
			// Floating steps round their data end; the total rounds away from zero like any bar.
			const path = s.total
				? columnPath(x, barW, y(0), y(s.end), Math.min(4, barW / 2))
				: Math.abs(y1 - y0) < 1
					? roundedRectPath(x, Math.min(y0, y1) - 0.5, barW, 1, {})
					: columnPath(x, barW, y0, y1, Math.min(4, barW / 2));
			const fill = s.total
				? 'var(--series-1)'
				: s.value > 0
					? 'var(--color-gain)'
					: s.value < 0
						? 'var(--color-loss)'
						: 'var(--color-neutral)';
			const labelY = up ? Math.min(y0, y1) - 6 : Math.max(y0, y1) + 13;
			return {
				step: s,
				cx,
				x,
				y0,
				y1,
				path,
				fill,
				labelY,
				label: compactSignedMoney(s.value, currency)
			};
		})
	);

	const connectors = $derived(
		bars.slice(0, -1).map((b, i) => {
			const next = bars[i + 1];
			return {
				key: b.step.key,
				x1: b.x + barW,
				x2: next ? next.x : b.x + barW,
				y: Math.round(y(b.step.end)) + 0.5
			};
		})
	);

	const xLabelRoom = $derived(band.step());
	/** Greek symbols when the columns are too narrow for words. */
	const SHORT_LABEL: Record<string, string> = {
		delta: 'Δ',
		gamma: 'Γ',
		theta: 'Θ',
		vega: 'ν',
		residual: 'Rest',
		total: 'Total'
	};

	const shortLabels = $derived(xLabelRoom < textWidth('Residual', FONT) + 6);

	const yTicks = $derived(
		yTickValues.map((t, i): AxisTick => ({ key: String(t), pos: y(t), label: yLabels[i] ?? '' }))
	);

	const targets = $derived(
		bars.map((b): HitTarget => ({
			key: b.step.key,
			x: margin.left + (band(b.step.key) ?? 0) - (band.step() * band.paddingInner()) / 2,
			y: margin.top,
			w: band.step(),
			h: innerHeight,
			label: `${b.step.label}: ${formatMoney(b.step.value, { currency, signed: true })}. ${b.step.note}.`
		}))
	);

	const activeBar = $derived(active === null ? null : (bars[active] ?? null));

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const b = activeBar;
		if (!b) return [];
		const rows: TooltipRow[] = [
			{
				label: b.step.total ? 'Actual' : 'Contribution',
				value: formatMoney(b.step.value, { currency, signed: true })
			}
		];
		if (!b.step.total)
			rows.push({
				label: 'Running total',
				value: formatMoney(b.step.end, { currency, signed: true })
			});
		return rows;
	});

	const summary = $derived(
		`Estimated P&L attribution: ${steps
			.filter((s) => !s.total)
			.map((s) => `${s.label.toLowerCase()} ${formatMoney(s.value, { currency, signed: true })}`)
			.join(', ')}; actual ${formatMoney(attribution.actual, { currency, signed: true })}.`
	);

	const tableRows = $derived(
		steps.map((s): TableRow => ({
			key: s.key,
			cells: [
				s.label,
				formatMoney(s.value, { currency, signed: true }),
				formatMoney(s.end, { currency, signed: true }),
				s.note
			]
		}))
	);
</script>

<figure class="chart" aria-label={summary}>
	<div class="wrap" bind:clientWidth={width} style:height="{height}px">
		{#if width > 0}
			<svg {width} {height} role="img" aria-label="Waterfall chart. {summary}">
				<g transform="translate({margin.left},{margin.top})">
					{#each yTicks as tick (tick.key)}
						<line
							class="grid"
							x1={0}
							x2={innerWidth}
							y1={Math.round(tick.pos) + 0.5}
							y2={Math.round(tick.pos) + 0.5}
						/>
						<text class="tick" x={-8} y={tick.pos} dy="0.32em" text-anchor="end">{tick.label}</text>
					{/each}
					<line class="zero" x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} />
					{#each connectors as c (c.key)}
						<line class="connector" x1={c.x1} x2={c.x2} y1={c.y} y2={c.y} />
					{/each}
					{#each bars as bar, i (bar.step.key)}
						<path
							d={bar.path}
							fill={bar.fill}
							class:dim={active !== null && active !== i}
							class="bar"
						/>
						<text class="value" x={bar.cx} y={bar.labelY} text-anchor="middle">{bar.label}</text>
						<text
							class="tick cat"
							class:strong={bar.step.total}
							x={bar.cx}
							y={innerHeight + 16}
							text-anchor="middle"
							>{shortLabels ? (SHORT_LABEL[bar.step.key] ?? bar.step.label) : bar.step.label}</text
						>
					{/each}
				</g>
			</svg>
			<MarkTargets {targets} label="Attribution steps" {active} onactive={(i) => (active = i)} />
			{#if activeBar}
				<ChartTooltip
					x={margin.left + activeBar.cx + barW / 2}
					y={margin.top + Math.min(activeBar.y0, activeBar.y1)}
					boundsWidth={width}
					boundsHeight={height}
					title={activeBar.step.label}
					rows={[...tooltipRows, { label: 'Why', value: activeBar.step.note }]}
				/>
			{/if}
		{/if}
	</div>
	<ChartTable
		caption="Estimated P&L attribution"
		columns={['Component', 'Contribution', 'Running total', 'Note']}
		rows={tableRows}
	/>
	<figcaption class="caption">
		An estimate from entry Greeks; the residual covers what they do not explain.
	</figcaption>
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
		stroke: var(--chart-axis);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.connector {
		stroke: var(--color-ink-3);
		stroke-width: 1;
		stroke-opacity: 0.6;
		shape-rendering: crispEdges;
	}

	.tick {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.tick.strong {
		fill: var(--color-ink-2);
		font-weight: 600;
	}

	.value {
		fill: var(--color-ink-2);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.bar.dim {
		opacity: 0.55;
	}

	.caption {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
