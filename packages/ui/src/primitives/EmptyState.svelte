<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		message: string;
		actions?: Snippet;
		icon?: Snippet;
	}

	let { title, message, actions, icon }: Props = $props();
</script>

<div class="empty">
	{#if icon}<div class="icon" aria-hidden="true">{@render icon()}</div>{/if}
	<h2>{title}</h2>
	<p>{message}</p>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-2);
		padding: var(--space-12) var(--space-6);
		border: 1px dashed var(--color-line-strong);
		border-radius: var(--radius-md);
	}

	.icon {
		font-size: 28px;
		color: var(--color-ink-3);
		margin-bottom: var(--space-2);
	}

	h2 {
		font-size: var(--text-md);
	}

	p {
		max-width: 46ch;
		color: var(--color-ink-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
