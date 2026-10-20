<script lang="ts">
	interface Props {
		/** Height of the mark in pixels; the wordmark scales with it. */
		size?: number;
		/** Show the "Strikebook" wordmark beside the mark. */
		wordmark?: boolean;
		/** Accessible name. Defaults to the product name. */
		label?: string;
	}

	let { size = 24, wordmark = true, label = 'Strikebook' }: Props = $props();
</script>

<span class="logo" style:--logo-size="{size}px" role="img" aria-label={label}>
	<svg class="mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
		<rect class="tile" width="32" height="32" rx="7" />
		<path class="axis" d="M6 20.5H26" />
		<path class="payoff" d="M6 23 12.5 23 20 11.5 26 11.5" />
		<circle class="kink" cx="12.5" cy="23" r="2.1" />
		<circle class="kink" cx="20" cy="11.5" r="2.1" />
	</svg>
	{#if wordmark}<span class="word" aria-hidden="true">Strikebook</span>{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--logo-size) * 0.38);
		color: var(--color-ink);
		line-height: 1;
	}

	.mark {
		flex: none;
		overflow: hidden;
	}

	.tile {
		fill: var(--color-ink);
	}

	.axis {
		fill: none;
		stroke: var(--color-ink-inverse);
		stroke-opacity: 0.28;
		stroke-width: 1;
	}

	.payoff {
		fill: none;
		stroke: var(--color-signal);
		stroke-width: 2.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.kink {
		fill: var(--color-ink-inverse);
	}

	.word {
		font-size: calc(var(--logo-size) * 0.72);
		font-weight: 600;
		letter-spacing: -0.025em;
		white-space: nowrap;
	}

	/* In dark mode the ink token is light; keep the tile dark and lifted from the page. */
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .tile {
			fill: var(--color-surface-3);
		}

		:global(:root:not([data-theme='light'])) .axis {
			stroke: var(--color-ink);
		}

		:global(:root:not([data-theme='light'])) .kink {
			fill: var(--color-ink);
		}
	}

	:global(:root[data-theme='dark']) .tile {
		fill: var(--color-surface-3);
	}

	:global(:root[data-theme='dark']) .axis {
		stroke: var(--color-ink);
	}

	:global(:root[data-theme='dark']) .kink {
		fill: var(--color-ink);
	}

	@media (forced-colors: active) {
		.tile {
			fill: CanvasText;
		}

		.payoff {
			stroke: Canvas;
		}

		.kink {
			fill: Canvas;
		}
	}
</style>
