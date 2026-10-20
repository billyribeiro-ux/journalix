<script lang="ts">
	interface Props {
		wins: number;
		losses: number;
		breakevens: number;
		/** Bar thickness in px. */
		height?: number;
	}

	let { wins, losses, breakevens, height = 10 }: Props = $props();

	let width = $state(0);

	const GAP = 2;
	const RADIUS = 4;

	const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

	const segments = $derived.by(() => {
		const parts = [
			{ key: 'win', label: 'Wins', count: safe(wins), color: 'var(--color-gain)' },
			{
				key: 'breakeven',
				label: 'Breakeven',
				count: safe(breakevens),
				color: 'var(--color-neutral)'
			},
			{ key: 'loss', label: 'Losses', count: safe(losses), color: 'var(--color-loss)' }
		];
		return parts;
	});

	const total = $derived(segments.reduce((s, p) => s + p.count, 0));

	function pct(count: number): string {
		if (total === 0) return '0%';
		return `${Math.round((count / total) * 100)}%`;
	}

	const laid = $derived.by(() => {
		const visible = segments.filter((s) => s.count > 0);
		const gaps = Math.max(0, visible.length - 1) * GAP;
		const usable = Math.max(0, width - gaps);
		let x = 0;
		return visible.map((s, i) => {
			const w = Math.max(2, (s.count / total) * usable);
			const r = Math.min(RADIUS, height / 2, w / 2);
			const first = i === 0;
			const last = i === visible.length - 1;
			const seg = { ...s, x, w, r, first, last };
			x += w + GAP;
			return seg;
		});
	});

	function path(
		x: number,
		w: number,
		h: number,
		r: number,
		roundLeft: boolean,
		roundRight: boolean
	): string {
		const lr = roundLeft ? r : 0;
		const rr = roundRight ? r : 0;
		return [
			`M${x + lr},0`,
			`H${x + w - rr}`,
			rr ? `A${rr},${rr} 0 0 1 ${x + w},${rr}` : '',
			`V${h - rr}`,
			rr ? `A${rr},${rr} 0 0 1 ${x + w - rr},${h}` : '',
			`H${x + lr}`,
			lr ? `A${lr},${lr} 0 0 1 ${x},${h - lr}` : '',
			`V${lr}`,
			lr ? `A${lr},${lr} 0 0 1 ${x + lr},0` : '',
			'Z'
		].join('');
	}

	const summary = $derived(
		total === 0
			? 'No closed trades.'
			: `${segments.map((s) => `${s.label} ${s.count} (${pct(s.count)})`).join(', ')} of ${total} closed trades.`
	);
</script>

<figure class="outcome" aria-label={summary}>
	<div class="track" bind:clientWidth={width} style:height="{height}px">
		{#if total === 0}
			<div class="empty-track" style:border-radius="{Math.min(RADIUS, height / 2)}px"></div>
		{:else if width > 0}
			<svg {width} {height} role="img" aria-label={summary}>
				{#each laid as seg (seg.key)}
					<path d={path(seg.x, seg.w, height, seg.r, seg.first, seg.last)} fill={seg.color} />
				{/each}
			</svg>
		{/if}
	</div>
	<figcaption>
		<ul class="legend" role="list">
			{#each segments as seg (seg.key)}
				<li>
					<span class="swatch" style:background={seg.color} aria-hidden="true"></span>
					<span class="name">{seg.label}</span>
					<span class="count">{seg.count}</span>
					<span class="pct">({pct(seg.count)})</span>
				</li>
			{/each}
		</ul>
	</figcaption>
</figure>

<style>
	.outcome {
		margin: 0;
		min-width: 0;
	}

	.track {
		width: 100%;
		min-width: 0;
	}

	svg {
		display: block;
	}

	.empty-track {
		height: 100%;
		background: var(--color-surface-3);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.swatch {
		width: 8px;
		height: 8px;
		margin-right: 2px;
		border-radius: 2px;
		flex: none;
	}

	.name {
		color: var(--color-ink-2);
	}

	.count {
		color: var(--color-ink);
		font-weight: 600;
	}

	.pct {
		color: var(--color-ink-3);
	}
</style>
