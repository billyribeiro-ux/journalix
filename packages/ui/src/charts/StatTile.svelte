<script lang="ts">
	import Sparkline from './Sparkline.svelte';

	interface Props {
		/** Sentence case, e.g. "Net P&L". */
		label: string;
		/** Pre-formatted figure. */
		value: string;
		/** Colours the value only; use it when the value is P&L. */
		tone?: 'neutral' | 'gain' | 'loss';
		/** Small secondary line, e.g. "42 wins of 73 trades". */
		detail?: string;
		/** Optional trend, drawn as a neutral sparkline with the last point accented. */
		trend?: readonly number[];
		/** Makes the whole tile a link. */
		href?: string;
		/** Large display figure (≥ 48px) with proportional numerals. */
		hero?: boolean;
	}

	let { label, value, tone = 'neutral', detail, trend, href, hero = false }: Props = $props();

	const trendLabel = $derived.by(() => {
		if (!trend || trend.length < 2) return '';
		const first = trend[0] ?? 0;
		const last = trend[trend.length - 1] ?? 0;
		const dir = last > first ? 'rising' : last < first ? 'falling' : 'flat';
		return `${label} trend, ${dir} over ${trend.length} points`;
	});
</script>

{#snippet body()}
	<span class="label">{label}</span>
	<span class={['value', { gain: tone === 'gain', loss: tone === 'loss' }]}>{value}</span>
	{#if detail || (trend && trend.length >= 2)}
		<span class="foot">
			{#if detail}<span class="detail">{detail}</span>{/if}
			{#if trend && trend.length >= 2}
				<span class="trend"
					><Sparkline
						values={trend}
						tone="neutral"
						label={trendLabel}
						width={72}
						height={22}
						accentLast
					/></span
				>
			{/if}
		</span>
	{/if}
{/snippet}

{#if href}
	<a class={['tile link', hero && 'hero']} {href}>{@render body()}</a>
{:else}
	<div class={['tile', hero && 'hero']}>{@render body()}</div>
{/if}

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		height: 100%;
		padding: var(--space-4);
		background: var(--color-surface);
		color: var(--color-ink);
		text-decoration: none;
		container-type: inline-size;
	}

	.link {
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.link:hover {
			background: var(--color-surface-2);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.link:active {
		background: var(--color-surface-3);
		transition-delay: 0s;
	}

	.link:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: -2px;
		border-radius: 0;
		transition-delay: 0s;
	}

	.label {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--color-ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		font-size: var(--text-xl);
		font-weight: 600;
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}

	/* Hero figures scale with their tile so large balances stay on one line. */
	.hero .value {
		font-size: clamp(var(--text-xl), 13cqi, var(--text-4xl));
		letter-spacing: var(--tracking-display);
		font-variant-numeric: proportional-nums;
		white-space: nowrap;
		overflow-wrap: normal;
	}

	/* The figure always carries its own sign (+/−), so hue is a second channel, not the only one.
	   *-text tokens hold 4.5:1 on the tile; the plain mark colours do not in light mode. */
	.value.gain {
		color: var(--color-gain-text);
	}

	.value.loss {
		color: var(--color-loss-text);
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: auto;
		min-width: 0;
	}

	.detail {
		min-width: 0;
		font-size: var(--text-xs);
		color: var(--color-ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.trend {
		margin-left: auto;
	}

	/* In a narrow tile the trend drops below the detail instead of squeezing it into an ellipsis. */
	@container (max-width: 175px) {
		.foot {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-1);
		}

		.trend {
			margin-left: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.link {
			transition: none;
		}
	}
</style>
