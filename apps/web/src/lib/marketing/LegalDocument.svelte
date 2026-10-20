<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatLongDate, LEGAL_EFFECTIVE_DATE } from '#lib/marketing/site.ts';

	interface Props {
		title: string;
		summary: string;
		children: Snippet;
	}

	let { title, summary, children }: Props = $props();
</script>

<header class="page-head container">
	<h1>{title}</h1>
	<p class="lede">{summary}</p>
	<p class="effective">
		Effective <time datetime={LEGAL_EFFECTIVE_DATE}>{formatLongDate(LEGAL_EFFECTIVE_DATE)}</time>
	</p>
</header>

<div class="container doc">
	<aside class="review" aria-label="Document status">
		<p>
			This document is provided for early access and will be reviewed by counsel before general
			availability.
		</p>
	</aside>
	<div class="prose">
		{@render children()}
	</div>
</div>

<style>
	.effective {
		margin-top: var(--space-4);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.doc {
		display: grid;
		gap: var(--space-8);
		padding-top: var(--space-10);
	}

	.review {
		max-width: var(--prose-max);
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--color-line-strong);
		background: var(--color-surface);
		color: var(--color-ink-2);
		font-size: var(--text-sm);
	}

	.doc :global(.prose h2:first-child) {
		margin-top: 0;
	}
</style>
