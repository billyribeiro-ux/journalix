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

<div class="strip" role="group" aria-label={label} style:--tile-min="{minTileWidth}px">
	{@render children()}
</div>

<style>
	.strip {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--tile-min)), 1fr));
		gap: 1px;
		background: var(--color-line);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.strip > :global(*) {
		background: var(--color-surface);
		min-width: 0;
	}
</style>
