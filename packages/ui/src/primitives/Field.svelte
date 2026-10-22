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

<div class={['field', error && 'invalid']}>
	<label for={htmlFor} class={[hideLabel && 'visually-hidden']}>
		{label}
		{#if optional}<span class="optional">Optional</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="message error" id="{htmlFor}-error" role="alert">
			<!-- A glyph, so the error is never signalled by colour alone. -->
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
				<circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5" />
				<path d="M6 3.4v3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				<circle cx="6" cy="8.5" r="0.9" fill="currentColor" />
			</svg>
			<span>{error}</span>
		</p>
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
		line-height: var(--leading-snug);
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
		line-height: var(--leading-snug);
		color: var(--color-ink-3);
		text-wrap: pretty;
	}

	.error {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		color: var(--color-loss-text);
	}

	.error svg {
		flex: none;
		margin-top: 2px;
	}
</style>
