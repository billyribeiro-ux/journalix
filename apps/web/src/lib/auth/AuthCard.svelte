<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle: string;
		children: Snippet;
		footer: Snippet;
	}

	let { title, subtitle, children, footer }: Props = $props();
</script>

<section class="card" aria-labelledby="auth-title">
	<h1 id="auth-title">{title}</h1>
	<p class="subtitle">{subtitle}</p>
	{@render children()}
	<div class="footer">{@render footer()}</div>
</section>

<style>
	.card {
		width: min(400px, 100%);
		padding: var(--space-8) var(--space-6);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
	}

	h1 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.subtitle {
		margin: var(--space-2) 0 var(--space-6);
		color: var(--color-ink-3);
	}

	.footer {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.footer :global(a) {
		color: var(--color-ink);
		font-weight: 500;
	}
</style>
