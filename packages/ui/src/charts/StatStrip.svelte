<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		/** Accessible name for the group of figures. */
		label?: string;
		/** Minimum tile width before the strip wraps. */
		minTileWidth?: number;
	}

	let { children, label, minTileWidth = 160 }: Props = $props();
</script>

<div class="strip" data-reveal role="group" aria-label={label} style:--tile-min="{minTileWidth}px">
	{@render children()}
</div>

<style>
	/* Hairline dividers are drawn by each tile's own offset shadow (clipped at the strip edge), not by a
	   grid-gap showing a coloured background, so a short last row leaves clean surface instead of a grey slab. */
	.strip {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--tile-min)), 1fr));
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.strip > :global(*) {
		background: var(--color-surface);
		min-width: 0;
		box-shadow: -1px -1px 0 0 var(--color-line);
	}
</style>
