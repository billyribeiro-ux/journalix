<script lang="ts">
	import { line, scaleLinear } from 'd3';

	interface Props {
		values: readonly number[];
		width?: number;
		height?: number;
		/** `auto` greens a rising series and reds a falling one; `neutral` stays in ink. */
		tone?: 'auto' | 'neutral';
		/** Accessible description, e.g. "Equity over the last 30 days, rising". */
		label: string;
		/** Accents the last point in the signal colour (used by StatTile trends). */
		accentLast?: boolean;
	}

	let {
		values,
		width = 96,
		height = 28,
		tone = 'auto',
		label,
		accentLast = false
	}: Props = $props();

	const PAD = 4;

	const clean = $derived(values.filter((v) => Number.isFinite(v)));

	const stroke = $derived.by(() => {
		if (tone === 'neutral' || clean.length < 2) return 'var(--color-ink-3)';
		const first = clean[0] ?? 0;
		const last = clean[clean.length - 1] ?? 0;
		return last >= first ? 'var(--color-gain)' : 'var(--color-loss)';
	});

	const y = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		for (const v of clean) {
			lo = Math.min(lo, v);
			hi = Math.max(hi, v);
		}
		if (!Number.isFinite(lo))
			return scaleLinear()
				.domain([0, 1])
				.range([height - PAD, PAD]);
		if (lo === hi)
			return scaleLinear()
				.domain([lo - 1, hi + 1])
				.range([height - PAD, PAD]);
		return scaleLinear()
			.domain([lo, hi])
			.range([height - PAD, PAD]);
	});

	const x = $derived(
		scaleLinear()
			.domain([0, Math.max(1, clean.length - 1)])
			.range([PAD, width - PAD])
	);

	const path = $derived(
		line<number>()
			.x((_, i) => x(i))
			.y((v) => y(v))(clean) ?? ''
	);

	const end = $derived(
		clean.length ? { x: x(clean.length - 1), y: y(clean[clean.length - 1] ?? 0) } : null
	);
</script>

<svg class="spark" {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
	{#if clean.length >= 2}
		<path
			d={path}
			fill="none"
			{stroke}
			stroke-width="1.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{/if}
	{#if end}
		<circle
			cx={end.x}
			cy={end.y}
			r="2.5"
			fill={accentLast ? 'var(--color-signal)' : stroke}
			stroke="var(--color-surface)"
			stroke-width="2"
			paint-order="stroke"
		/>
	{/if}
</svg>

<style>
	.spark {
		display: block;
		flex: none;
		overflow: visible;
	}
</style>
