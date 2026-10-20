<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
		back?: { href: string; label: string };
		children?: Snippet;
	}

	let { title, description, actions, back, children }: Props = $props();
</script>

<header class="page-header">
	<div class="text">
		{#if back}<a class="back" href={back.href}>{back.label}</a>{/if}
		<h1>{title}</h1>
		{#if description}<p>{description}</p>{/if}
		{#if children}{@render children()}{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}

	.text {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}

	.back {
		font-size: var(--text-sm);
		color: var(--color-ink-3);
		text-decoration: none;
		margin-bottom: var(--space-1);
	}

	.back:hover {
		color: var(--color-ink);
	}

	.back::before {
		content: '‹ ';
	}

	h1 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	p {
		color: var(--color-ink-3);
		max-width: var(--prose-max);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
