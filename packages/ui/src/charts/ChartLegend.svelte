<script lang="ts">
	import type { LegendItem } from './chart-utils.ts';

	interface Props {
		items: readonly LegendItem[];
	}

	let { items }: Props = $props();
</script>

{#if items.length >= 2}
	<ul class="legend" role="list">
		{#each items as item (item.key)}
			<li>
				<span class="swatch {item.shape ?? 'square'}" style:--swatch={item.color} aria-hidden="true"
				></span>
				{item.label}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--color-ink-2);
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		flex: none;
		background: var(--swatch);
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
		box-shadow: 0 0 0 2px var(--color-surface);
	}

	.line {
		width: 16px;
		height: 2px;
		border-radius: 1px;
	}
</style>
