<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		checked?: boolean;
		id: string;
		disabled?: boolean;
		children: Snippet;
		description?: string;
	}

	let { checked = $bindable(false), id, disabled = false, children, description }: Props = $props();
</script>

<div class="check">
	<input
		type="checkbox"
		{id}
		bind:checked
		{disabled}
		aria-describedby={description ? `${id}-desc` : undefined}
	/>
	<label for={id}>
		{@render children()}
		{#if description}<span class="desc" id="{id}-desc">{description}</span>{/if}
	</label>
</div>

<style>
	.check {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	input {
		width: 16px;
		height: 16px;
		margin: 2px 0 0;
		accent-color: var(--color-signal);
		flex: none;
	}

	label {
		display: grid;
		gap: 2px;
		font-size: var(--text-base);
		cursor: pointer;
	}

	.desc {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}
</style>
