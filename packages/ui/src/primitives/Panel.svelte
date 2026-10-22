<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		subtitle?: string;
		actions?: Snippet;
		children: Snippet;
		flush?: boolean;
		id?: string;
	}

	let { title, subtitle, actions, children, flush = false, id }: Props = $props();
</script>

<section
	class={['panel', flush && 'flush']}
	aria-labelledby={title && id ? `${id}-title` : undefined}
>
	{#if title || actions}
		<header>
			<div class="titles">
				{#if title}<h2 id={id ? `${id}-title` : undefined}>{title}</h2>{/if}
				{#if subtitle}<p>{subtitle}</p>{/if}
			</div>
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class="content">{@render children()}</div>
</section>

<style>
	.panel {
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		min-width: 0;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		padding: var(--space-4) var(--space-5) 0;
	}

	h2 {
		font-size: var(--text-md);
		font-weight: 600;
		line-height: var(--leading-snug);
		letter-spacing: -0.01em;
	}

	.titles {
		flex: 1 1 240px;
		min-width: 0;
	}

	.titles p {
		margin-top: 2px;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		color: var(--color-ink-3);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.content {
		padding: var(--space-4) var(--space-5) var(--space-5);
	}

	.flush .content {
		padding: var(--space-3) 0 0;
	}

	@media (max-width: 480px) {
		header {
			padding-inline: var(--space-4);
		}

		.content {
			padding-inline: var(--space-4);
		}
	}
</style>
