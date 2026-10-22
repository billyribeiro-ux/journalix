<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle: string;
		children: Snippet;
		footer: Snippet;
		/** A form-level failure (wrong credentials, rate limit, server error). Announced at once. */
		error?: string | null;
	}

	let { title, subtitle, children, footer, error = null }: Props = $props();
</script>

<section class="card" aria-labelledby="auth-title">
	<h1 id="auth-title">{title}</h1>
	<p class="subtitle">{subtitle}</p>
	{#if error}
		<p class="alert" role="alert">
			<!-- A glyph, so the failure is never signalled by colour alone. -->
			<svg width="16" height="16" viewBox="0 0 12 12" aria-hidden="true">
				<circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" stroke-width="1.25" />
				<path d="M6 3.4v3.2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
				<circle cx="6" cy="8.5" r="0.8" fill="currentColor" />
			</svg>
			<span>{error}</span>
		</p>
	{/if}
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
		box-shadow: var(--shadow-pop);
	}

	h1 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.subtitle {
		margin: var(--space-2) 0 var(--space-6);
		color: var(--color-ink-2);
		text-wrap: pretty;
	}

	.alert {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin: calc(-1 * var(--space-2)) 0 var(--space-5);
		padding: var(--space-3);
		border-left: 3px solid var(--color-loss);
		border-radius: var(--radius-xs);
		background: var(--color-loss-soft);
		color: var(--color-ink);
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
	}

	.alert svg {
		flex: none;
		margin-top: 1px;
		color: var(--color-loss-text);
	}

	.footer {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
		font-size: var(--text-sm);
		color: var(--color-ink-2);
	}

	.footer :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 28px;
		color: var(--color-ink);
		font-weight: 500;
	}

	@media (pointer: coarse) {
		.footer :global(a) {
			min-height: var(--control-touch);
		}
	}
</style>
