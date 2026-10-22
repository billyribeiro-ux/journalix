<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatLongDate, LEGAL_EFFECTIVE_DATE } from '#lib/marketing/site.ts';

	interface Props {
		title: string;
		summary: string;
		children: Snippet;
	}

	let { title, summary, children }: Props = $props();

	interface Heading {
		readonly id: string;
		readonly text: string;
	}

	// The documents are plain headings and paragraphs; the contents list is read from them once the
	// page is in the browser, so the legal text itself stays the single source and works without JS.
	let headings = $state.raw<readonly Heading[]>([]);

	function slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function collect(node: HTMLElement): void {
		const found: Heading[] = [];
		for (const h2 of node.querySelectorAll('h2')) {
			const text = h2.textContent?.trim() ?? '';
			if (!text) continue;
			if (!h2.id) h2.id = slugify(text);
			found.push({ id: h2.id, text });
		}
		headings = found;
	}
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
	<div class="doc-grid">
		<div class="prose" {@attach collect}>
			{@render children()}
		</div>

		{#if headings.length > 2}
			<nav class="doc-toc" aria-labelledby="doc-toc-title">
				<h2 id="doc-toc-title">In this document</h2>
				<ol role="list">
					{#each headings as heading (heading.id)}
						<li><a href="#{heading.id}">{heading.text}</a></li>
					{/each}
				</ol>
			</nav>
		{/if}
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
		grid-template-columns: minmax(0, 1fr);
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
