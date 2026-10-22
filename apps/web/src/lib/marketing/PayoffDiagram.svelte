<script lang="ts">
	import { payoffCurve, payoffProfile, formatMoney, type PayoffLeg } from '@journalix/core';

	interface Props {
		legs: readonly PayoffLeg[];
		/** Underlying price range drawn on the x axis. */
		range: { readonly min: number; readonly max: number };
		/** Underlying price at entry, marked with a vertical rule. */
		spot: number;
		rate?: number;
		title: string;
		description: string;
	}

	let { legs, range, spot, rate = 0.04, title, description }: Props = $props();

	// Unique per instance, so several diagrams on one page never share ids.
	const uid = $props.id();

	const W = 560;
	const H = 280;
	const PAD = { top: 20, right: 16, bottom: 36, left: 64 };
	const innerW = W - PAD.left - PAD.right;
	const innerH = H - PAD.top - PAD.bottom;

	const points = $derived(
		payoffCurve(legs, range, { samples: 121, rate, includeTheoretical: true })
	);
	const profile = $derived(payoffProfile(legs));

	const yDomain = $derived.by(() => {
		const values = points.flatMap((p) => [p.expiry, p.theoretical ?? p.expiry]);
		const lo = Math.min(...values, 0);
		const hi = Math.max(...values, 0);
		const pad = (hi - lo) * 0.12;
		return { lo: lo - pad, hi: hi + pad };
	});

	const x = (price: number): number =>
		PAD.left + ((price - range.min) / (range.max - range.min)) * innerW;
	const y = (pnl: number): number =>
		PAD.top + (1 - (pnl - yDomain.lo) / (yDomain.hi - yDomain.lo)) * innerH;

	const path = (key: 'expiry' | 'theoretical'): string =>
		points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.price).toFixed(1)} ${y(p[key] ?? 0).toFixed(1)}`)
			.join(' ');

	const expiryPath = $derived(path('expiry'));
	const todayPath = $derived(
		points.every((p) => p.theoretical !== null) ? path('theoretical') : null
	);

	/** Area between the expiry line and zero, split by sign, for the profit/loss zones. */
	function zone(sign: 1 | -1): string {
		const zero = y(0);
		const clipped = points.map((p) => ({
			px: x(p.price),
			py: y(sign > 0 ? Math.max(0, p.expiry) : Math.min(0, p.expiry))
		}));
		const first = clipped[0];
		const last = clipped[clipped.length - 1];
		if (!first || !last) return '';
		return `M${first.px.toFixed(1)} ${zero.toFixed(1)} ${clipped
			.map((c) => `L${c.px.toFixed(1)} ${c.py.toFixed(1)}`)
			.join(' ')} L${last.px.toFixed(1)} ${zero.toFixed(1)} Z`;
	}

	const yTicks = $derived.by(() => {
		const ticks: number[] = [0];
		if (profile.maxProfit !== null) ticks.push(profile.maxProfit);
		if (profile.maxLoss !== null) ticks.push(profile.maxLoss);
		// A payoff that never loses (or never gains) repeats the zero line; keys must stay unique.
		return [...new Set(ticks)];
	});

	const strikes = $derived([
		...new Set(legs.filter((l) => l.strike !== null).map((l) => l.strike as number))
	]);
</script>

<figure class="payoff">
	<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="{uid}-title {uid}-desc">
		<title id="{uid}-title">{title}</title>
		<desc id="{uid}-desc">{description}</desc>

		<path class="zone gain" d={zone(1)} />
		<path class="zone loss" d={zone(-1)} />

		{#each yTicks as tick (tick)}
			<line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
			<text class="tick" x={PAD.left - 8} y={y(tick)} dy="0.32em" text-anchor="end"
				>{formatMoney(tick, { digits: 0 })}</text
			>
		{/each}

		{#each strikes as strike (strike)}
			<line class="strike" x1={x(strike)} x2={x(strike)} y1={PAD.top} y2={H - PAD.bottom} />
			<text class="tick" x={x(strike)} y={H - PAD.bottom + 18} text-anchor="middle">{strike}</text>
		{/each}

		<line class="spot" x1={x(spot)} x2={x(spot)} y1={PAD.top} y2={H - PAD.bottom} />

		{#if todayPath}<path class="today" d={todayPath} />{/if}
		<path class="expiry" d={expiryPath} />

		{#each profile.breakevens as be (be)}
			<circle class="be" cx={x(be)} cy={y(0)} r="3.5" />
		{/each}
	</svg>
	<figcaption>
		<span class="key"><span class="swatch expiry-swatch"></span>At expiry</span>
		<span class="key"><span class="swatch today-swatch"></span>Today (Black-Scholes)</span>
		<span class="key"><span class="swatch spot-swatch"></span>Underlying at entry</span>
		<span class="key"><span class="swatch be-swatch"></span>Breakeven</span>
	</figcaption>
</figure>

<style>
	.payoff {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
		container-type: inline-size;
	}

	svg {
		width: 100%;
		height: auto;
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
	}

	.zone {
		stroke: none;
	}

	.zone.gain {
		fill: var(--color-gain-soft);
	}

	.zone.loss {
		fill: var(--color-loss-soft);
	}

	.grid {
		stroke: var(--chart-grid);
		stroke-width: 1;
	}

	.strike {
		stroke: var(--chart-axis);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}

	.spot {
		stroke: var(--color-ink-3);
		stroke-width: 1;
	}

	/* ink-3 (5.9:1 on the white panel, 6.2:1 in dark) rather than the chart token (4.8:1 light): these
	   are the only numbers on the diagram, so they get the more comfortable margin. */
	.tick {
		fill: var(--color-ink-3);
		font-size: 12px;
	}

	/* The drawing scales with its container, so 12 user units fall to about 7px on a phone. Grow the
	   labels in user units as the box narrows to keep them near 9 to 10 rendered pixels. */
	@container (max-width: 480px) {
		.tick {
			font-size: 16px;
		}
	}

	.expiry {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.today {
		fill: none;
		stroke: var(--series-1);
		stroke-width: 1.75;
		stroke-dasharray: 5 4;
	}

	.be {
		fill: var(--color-surface);
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		display: inline-block;
		width: 16px;
		height: 0;
		border-top: 2px solid var(--color-ink);
	}

	.today-swatch {
		border-top: 2px dashed var(--series-1);
	}

	.spot-swatch {
		width: 0;
		height: 12px;
		border-top: 0;
		border-left: 1px solid var(--color-ink-3);
	}

	.be-swatch {
		width: 8px;
		height: 8px;
		border: 1.5px solid var(--color-ink);
		border-radius: 50%;
		background: var(--color-surface);
	}
</style>
