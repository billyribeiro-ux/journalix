<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		/** id of the control this label describes */
		for: string;
		help?: string;
		error?: string | null;
		optional?: boolean;
		hideLabel?: boolean;
		children: Snippet;
	}

	let {
		label,
		for: htmlFor,
		help,
		error = null,
		optional = false,
		hideLabel = false,
		children
	}: Props = $props();
</script>

<div class="field" class:invalid={!!error}>
	<label for={htmlFor} class:visually-hidden={hideLabel}>
		{label}
		{#if optional}<span class="optional">Optional</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="message error" id="{htmlFor}-error" role="alert">{error}</p>
	{:else if help}
		<p class="message" id="{htmlFor}-help">{help}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
		/* Stretched grid cells must not spread label, control and help apart. */
		align-content: start;
		min-width: 0;
	}

	label {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--color-ink-2);
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.optional {
		font-weight: 400;
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}

	.message {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	.error {
		color: var(--color-loss);
	}
</style>
