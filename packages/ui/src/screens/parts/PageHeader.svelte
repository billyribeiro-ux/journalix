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

<header class="page-header" data-reveal="fade">
	<div class="text">
		{#if back}<a class="back tap-target" href={back.href}>{back.label}</a>{/if}
		<h1>{title}</h1>
		{#if description}<p>{description}</p>{/if}
		{@render children?.()}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		margin-bottom: var(--space-6);
	}

	.text {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
		/* Wraps its actions below before it gets squeezed under ~280px. */
		flex: 1 1 280px;
	}

	.back {
		justify-self: start;
		font-size: var(--text-sm);
		color: var(--color-ink-3);
		text-decoration: none;
		margin-bottom: var(--space-1);
		transition: color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.back:hover {
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.back:focus-visible {
		transition-delay: 0s;
	}

	.back::before {
		content: '‹ ';
	}

	h1 {
		/* 23px on a phone, 28px from tablet up; long titles wrap and balance. */
		font-size: clamp(var(--text-xl), 1.1rem + 1.1vw, var(--text-2xl));
		letter-spacing: var(--tracking-display);
		overflow-wrap: anywhere;
	}

	p {
		color: var(--color-ink-3);
		max-width: var(--prose-max);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
