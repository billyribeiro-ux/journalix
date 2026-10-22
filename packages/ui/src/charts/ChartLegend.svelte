<script lang="ts">
	import type { LegendItem } from './chart-utils.ts';

	interface Props {
		items: readonly LegendItem[];
		/**
		 * Keys currently switched off. Only meaningful together with `ontoggle`; without it the legend is a
		 * plain key.
		 */
		hidden?: ReadonlySet<string>;
		/** Makes each entry a real toggle button (`aria-pressed`) that shows or hides its series. */
		ontoggle?: (key: string) => void;
	}

	let { items, hidden = new Set<string>(), ontoggle }: Props = $props();

	/** The last visible series cannot be switched off, so a chart never goes blank by accident. */
	const visibleCount = $derived(items.filter((i) => !hidden.has(i.key)).length);
</script>

{#if items.length >= 2}
	<ul class="legend" role="list">
		{#each items as item (item.key)}
			{@const off = hidden.has(item.key)}
			<li>
				{#if ontoggle}
					<button
						type="button"
						class={['entry', off && 'off']}
						aria-pressed={!off}
						aria-disabled={!off && visibleCount <= 1 ? true : undefined}
						onclick={() => {
							if (off || visibleCount > 1) ontoggle(item.key);
						}}
					>
						<span
							class="swatch {item.shape ?? 'square'}"
							style:--swatch={item.color}
							aria-hidden="true"
						></span>
						{item.label}
					</button>
				{:else}
					<span class="entry">
						<span
							class="swatch {item.shape ?? 'square'}"
							style:--swatch={item.color}
							aria-hidden="true"
						></span>
						{item.label}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-2);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--color-ink-2);
	}

	.entry {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 24px;
		padding: 0 var(--space-2);
		margin: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
	}

	button.entry {
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		button.entry:hover {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	button.entry:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: 0;
		transition-delay: 0s;
	}

	button.entry:active {
		background: var(--color-pressed);
		transition-delay: 0s;
	}

	button.entry[aria-disabled='true'] {
		cursor: default;
	}

	@media (pointer: coarse) {
		button.entry {
			min-height: var(--control-touch);
			padding-inline: var(--space-3);
		}
	}

	/* A switched-off series keeps its place in the key but reads as hollow and quiet. */
	.entry.off {
		color: var(--color-ink-3);
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	.entry.off .swatch {
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--swatch);
	}

	.swatch {
		flex: none;
		background: var(--swatch);
		forced-color-adjust: none;
	}

	.square {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.diamond {
		width: 9px;
		height: 9px;
		transform: rotate(45deg) scale(0.86);
		border-radius: 1px;
	}

	.ring {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: transparent;
		box-shadow: inset 0 0 0 2px var(--swatch);
	}

	.line {
		width: 16px;
		height: 2px;
		border-radius: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		button.entry {
			transition: none;
		}
	}
</style>
