<script lang="ts">
	import type { PayoffLeg, PayoffPoint } from '@journalix/core';
	import { formatMoney, payoffCurve, payoffProfile, payoffRange } from '@journalix/core';
	import { bisector, line, scaleLinear } from 'd3';
	import ChartEmpty from './ChartEmpty.svelte';
	import ChartLegend from './ChartLegend.svelte';
	import ChartTable from './ChartTable.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import ScrubSurface from './ScrubSurface.svelte';
	import type { AxisTick, LegendItem, TableRow, TooltipRow } from './chart-utils.ts';
	import { compactMoney, priceLabel, spaceTicks, textWidth, tickCount } from './chart-utils.ts';

	interface Props {
		legs: readonly PayoffLeg[];
		spot: number | null;
		rate: number;
		currency: string;
		height?: number;
		showTheoretical?: boolean;
		breakevens?: readonly number[];
		markers?: readonly { price: number; label: string }[];
	}

	let {
		legs,
		spot,
		rate,
		currency,
		height = 300,
		showTheoretical = true,
		breakevens,
		markers = []
	}: Props = $props();

	const uid = $props.id();
	const clipAbove = `${uid}-above`;
	const clipBelow = `${uid}-below`;

	let width = $state(0);
	let active = $state<number | null>(null);

	const FONT = 11;

	const range = $derived.by(() => {
		const base = payoffRange(legs, spot);
		// Widen so markers stay inside the plot.
		let { min, max } = base;
		for (const m of markers) {
			if (m.price < min) min = Math.max(0, m.price - (max - min) * 0.05);
			if (m.price > max) max = m.price + (max - min) * 0.05;
		}
		return { min, max };
	});

	const curve = $derived(
		legs.length === 0
			? []
			: payoffCurve(legs, range, { samples: 241, rate, includeTheoretical: showTheoretical })
	);
	const hasTheoretical = $derived(showTheoretical && curve.some((p) => p.theoretical !== null));
	const profile = $derived(legs.length === 0 ? null : payoffProfile(legs));
	const bes = $derived(
		(breakevens ?? profile?.breakevens ?? []).filter((b) => b >= range.min && b <= range.max)
	);

	const yRaw = $derived.by(() => {
		let lo = 0;
		let hi = 0;
		for (const p of curve) {
			lo = Math.min(lo, p.expiry, p.theoretical ?? 0);
			hi = Math.max(hi, p.expiry, p.theoretical ?? 0);
		}
		if (lo === hi) hi = 1;
		const span = hi - lo;
		return scaleLinear()
			.domain([lo - span * 0.08, hi + span * 0.12])
			.nice(tickCount(height, 50));
	});

	const yTickValues = $derived(yRaw.ticks(tickCount(height - 60, 44)));
	const yLabels = $derived(yTickValues.map((t) => compactMoney(t, currency)));

	const margin = $derived({
		top: 22,
		right: 12,
		bottom: 24,
		left: Math.ceil(yLabels.reduce((m, l) => Math.max(m, textWidth(l, FONT)), 0) + 10)
	});

	const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
	const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

	const x = $derived(scaleLinear().domain([range.min, range.max]).range([0, innerWidth]));
	const y = $derived(yRaw.copy().range([innerHeight, 0]));
	const zeroY = $derived(y(0));

	const expiryPath = $derived(
		line<PayoffPoint>()
			.x((p) => x(p.price))
			.y((p) => y(p.expiry))(curve) ?? ''
	);

	const expiryArea = $derived(
		curve.length ? `${expiryPath}L${x(range.max)},${zeroY}L${x(range.min)},${zeroY}Z` : ''
	);

	const theoreticalPath = $derived(
		hasTheoretical
			? (line<PayoffPoint>()
					.defined((p) => p.theoretical !== null)
					.x((p) => x(p.price))
					.y((p) => y(p.theoretical ?? 0))(curve) ?? '')
			: ''
	);

	const xTicks = $derived.by((): AxisTick[] => {
		if (innerWidth <= 0) return [];
		const sample = priceLabel(range.max, currency);
		return spaceTicks(
			x
				.ticks(tickCount(innerWidth, Math.max(64, textWidth(sample, FONT) + 24)))
				.map((t) => ({ key: String(t), pos: x(t), label: priceLabel(t, currency) }))
		);
	});

	const yTicks = $derived(
		yTickValues.map((t, i): AxisTick => ({ key: String(t), pos: y(t), label: yLabels[i] ?? '' }))
	);

	interface VLabel {
		readonly key: string;
		readonly x: number;
		readonly text: string;
		readonly kind: 'spot' | 'marker';
		readonly row: number;
		readonly anchor: 'start' | 'middle' | 'end';
	}

	/** Vertical reference labels, stacked into rows above the plot so they never overlap. */
	const vLabels = $derived.by((): VLabel[] => {
		const items: { key: string; x: number; text: string; kind: 'spot' | 'marker' }[] = [];
		if (spot !== null && spot >= range.min && spot <= range.max) {
			items.push({
				key: 'spot',
				x: x(spot),
				text: `Spot ${priceLabel(spot, currency)}`,
				kind: 'spot'
			});
		}
		markers.forEach((m, i) => {
			if (m.price >= range.min && m.price <= range.max)
				items.push({ key: `m${i}`, x: x(m.price), text: m.label, kind: 'marker' });
		});
		items.sort((a, b) => a.x - b.x);
		const rowsEnd: number[] = [];
		return items.map((it) => {
			const w = textWidth(it.text, FONT);
			const anchor = it.x - w / 2 < 0 ? 'start' : it.x + w / 2 > innerWidth ? 'end' : 'middle';
			const left = anchor === 'start' ? it.x : anchor === 'end' ? it.x - w : it.x - w / 2;
			let row = rowsEnd.findIndex((end) => left > end + 6);
			if (row === -1) {
				row = rowsEnd.length;
				rowsEnd.push(-Infinity);
			}
			rowsEnd[row] = left + w;
			return { ...it, row, anchor };
		});
	});

	const labelRows = $derived(vLabels.reduce((m, l) => Math.max(m, l.row + 1), 0));
	const topPad = $derived(Math.max(0, labelRows - 1) * 14);

	/** Breakeven labels sit just below the zero line, alternating sides to avoid collisions. */
	const beLabels = $derived.by(() => {
		let lastRight = -Infinity;
		return bes.map((b, i) => {
			const text = `Breakeven ${priceLabel(b, currency)}`;
			const short = priceLabel(b, currency);
			const px = x(b);
			const full = textWidth(text, FONT);
			const useFull = px - full / 2 > lastRight + 8 && px + full / 2 < innerWidth;
			const label = useFull ? text : short;
			const w = textWidth(label, FONT);
			const left = Math.max(0, Math.min(innerWidth - w, px - w / 2));
			const visible = left > lastRight + 6;
			if (visible) lastRight = left + w;
			return { key: `${b}-${i}`, x: px, labelX: left + w / 2, label, visible };
		});
	});

	const extremes = $derived.by(() => {
		if (!profile) return { profit: '', loss: '' };
		const profit =
			profile.maxProfit === null
				? 'Max profit unlimited'
				: `Max profit ${formatMoney(profile.maxProfit, { currency, signed: true, digits: 0 })}`;
		const loss =
			profile.maxLoss === null
				? 'Max loss unlimited'
				: `Max loss ${formatMoney(profile.maxLoss, { currency, digits: 0 })}`;
		return { profit, loss };
	});

	const xs = $derived(curve.map((p) => x(p.price)));
	const finder = bisector<number, number>((d) => d).center;

	function locate(px: number): number | null {
		if (curve.length === 0) return null;
		return Math.max(0, Math.min(curve.length - 1, finder(xs, px)));
	}

	const activePoint = $derived(active === null ? null : (curve[active] ?? null));

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const p = activePoint;
		if (!p) return [];
		const rows: TooltipRow[] = [
			{
				label: 'At expiry',
				value: formatMoney(p.expiry, { currency, signed: true }),
				swatch: 'var(--color-ink-2)'
			}
		];
		if (hasTheoretical && p.theoretical !== null)
			rows.push({
				label: 'Today',
				value: formatMoney(p.theoretical, { currency, signed: true }),
				swatch: 'var(--series-1)'
			});
		return rows;
	});

	const valueText = $derived.by(() => {
		const p = activePoint;
		if (!p) return '';
		const today =
			hasTheoretical && p.theoretical !== null
				? `, today ${formatMoney(p.theoretical, { currency, signed: true })}`
				: '';
		return `Underlying ${priceLabel(p.price, currency)}: at expiry ${formatMoney(p.expiry, { currency, signed: true })}${today}`;
	});

	const legend = $derived.by((): LegendItem[] =>
		hasTheoretical
			? [
					{ key: 'expiry', label: 'At expiry', color: 'var(--color-ink-2)', shape: 'line' },
					{ key: 'today', label: 'Today', color: 'var(--series-1)', shape: 'line' }
				]
			: []
	);

	const summary = $derived.by(() => {
		if (!profile) return 'Payoff diagram with no legs.';
		const be = bes.length
			? ` Breakevens at ${bes.map((b) => priceLabel(b, currency)).join(' and ')}.`
			: '';
		return `Payoff at expiry: ${extremes.profit.toLowerCase()}, ${extremes.loss.toLowerCase()}.${be}${spot !== null ? ` Spot ${priceLabel(spot, currency)}.` : ''}`;
	});

	const tableRows = $derived.by((): TableRow[] => {
		if (curve.length === 0) return [];
		const step = Math.max(1, Math.floor(curve.length / 24));
		return curve
			.filter((_, i) => i % step === 0 || i === curve.length - 1)
			.map((p) => ({
				key: String(p.price),
				cells: [
					priceLabel(p.price, currency),
					formatMoney(p.expiry, { currency, signed: true }),
					...(hasTheoretical ? [formatMoney(p.theoretical, { currency, signed: true })] : [])
				]
			}));
	});
</script>

<figure class="chart" aria-label={summary}>
	<figcaption class="visually-hidden">{summary}</figcaption>
	{#if legs.length === 0}
		<ChartEmpty message="Add legs to see the payoff" {height} />
	{:else}
		<div class="head">
			<ChartLegend items={legend} />
			<p class="extremes">
				<span>{extremes.profit}</span>
				<span>{extremes.loss}</span>
			</p>
		</div>
		<div class="wrap" bind:clientWidth={width} style:height="{height + topPad}px">
			{#if width > 0}
				<svg
					{width}
					height={height + topPad}
					role="img"
					aria-label="Options payoff diagram. {summary}"
				>
					<defs>
						<clipPath id={clipAbove}
							><rect x={0} y={-4} width={innerWidth} height={Math.max(0, zeroY + 4)} /></clipPath
						>
						<clipPath id={clipBelow}
							><rect
								x={0}
								y={zeroY}
								width={innerWidth}
								height={Math.max(0, innerHeight - zeroY + 4)}
							/></clipPath
						>
					</defs>
					<g transform="translate({margin.left},{margin.top + topPad})">
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

						<path class="fill-gain" d={expiryArea} clip-path="url(#{clipAbove})" />
						<path class="fill-loss" d={expiryArea} clip-path="url(#{clipBelow})" />
						<line
							class="zero"
							x1={0}
							x2={innerWidth}
							y1={Math.round(zeroY) + 0.5}
							y2={Math.round(zeroY) + 0.5}
						/>

						{#each vLabels as v (v.key)}
							<line
								class={v.kind === 'spot' ? 'spot' : 'marker-line'}
								x1={Math.round(v.x) + 0.5}
								x2={Math.round(v.x) + 0.5}
								y1={-4 - v.row * 14}
								y2={innerHeight}
							/>
						{/each}
						{#each vLabels as v (v.key)}
							<text
								class="ref-label halo"
								class:strong={v.kind === 'spot'}
								x={v.x}
								y={-8 - v.row * 14}
								text-anchor={v.anchor}>{v.text}</text
							>
						{/each}

						{#if theoreticalPath}
							<path class="theoretical" d={theoreticalPath} />
						{/if}
						<path class="expiry" d={expiryPath} />

						{#each beLabels as be (be.key)}
							<circle class="be-dot" cx={be.x} cy={zeroY} r={4} />
							{#if be.visible}
								<text class="be-label halo" x={be.labelX} y={zeroY + 16} text-anchor="middle"
									>{be.label}</text
								>
							{/if}
						{/each}

						{#if activePoint}
							<line
								class="crosshair"
								x1={Math.round(x(activePoint.price)) + 0.5}
								x2={Math.round(x(activePoint.price)) + 0.5}
								y1={0}
								y2={innerHeight}
							/>
							<circle
								class="hover-dot ink"
								cx={x(activePoint.price)}
								cy={y(activePoint.expiry)}
								r={4}
							/>
							{#if hasTheoretical && activePoint.theoretical !== null}
								<circle
									class="hover-dot series"
									cx={x(activePoint.price)}
									cy={y(activePoint.theoretical)}
									r={4}
								/>
							{/if}
						{/if}
					</g>
				</svg>
				<ScrubSurface
					left={0}
					top={margin.top + topPad}
					{width}
					height={innerHeight}
					label="Payoff by underlying price. Use the arrow keys to move along the curve."
					count={curve.length}
					{active}
					{valueText}
					onactive={(i) => (active = i)}
					locate={(px) => locate(px - margin.left)}
				/>
				{#if activePoint}
					<ChartTooltip
						x={margin.left + x(activePoint.price)}
						y={margin.top + topPad + y(activePoint.expiry)}
						boundsWidth={width}
						boundsHeight={height + topPad}
						title="Underlying {priceLabel(activePoint.price, currency)}"
						rows={tooltipRows}
					/>
				{/if}
			{/if}
		</div>
		<ChartTable
			caption="Profit and loss by underlying price"
			columns={hasTheoretical ? ['Underlying', 'At expiry', 'Today'] : ['Underlying', 'At expiry']}
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
		stroke: var(--chart-axis);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.tick {
		fill: var(--chart-text);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.fill-gain {
		fill: var(--color-gain);
		fill-opacity: 0.12;
	}

	.fill-loss {
		fill: var(--color-loss);
		fill-opacity: 0.12;
	}

	.expiry {
		fill: none;
		stroke: var(--color-ink-2);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.theoretical {
		fill: none;
		stroke: var(--series-1);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.spot {
		stroke: var(--color-signal);
		stroke-width: 2;
	}

	.marker-line {
		stroke: var(--color-ink-3);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.ref-label {
		fill: var(--color-ink-3);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.ref-label.strong {
		fill: var(--color-ink);
		font-weight: 600;
	}

	.be-dot {
		fill: var(--color-ink-2);
		stroke: var(--color-surface);
		stroke-width: 2;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0 var(--space-4);
	}

	.extremes {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		margin: 0 0 var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-ink-2);
		font-variant-numeric: tabular-nums;
	}

	.be-label {
		fill: var(--color-ink-2);
		font-size: var(--text-2xs);
		font-variant-numeric: tabular-nums;
	}

	.halo {
		paint-order: stroke;
		stroke: var(--color-surface);
		stroke-width: 3px;
		stroke-linejoin: round;
	}

	.crosshair {
		stroke: var(--chart-crosshair);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.hover-dot {
		stroke: var(--color-surface);
		stroke-width: 2;
	}

	.hover-dot.ink {
		fill: var(--color-ink-2);
	}

	.hover-dot.series {
		fill: var(--series-1);
	}
</style>
