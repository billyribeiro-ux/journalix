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
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin-bottom: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface-2);
		font-size: 24px;
		color: var(--color-ink-2);
	}

	h2 {
		font-size: var(--text-md);
		line-height: var(--leading-snug);
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

	@media (max-width: 480px) {
		.empty {
			padding: var(--space-8) var(--space-4);
		}
	}
</style>
