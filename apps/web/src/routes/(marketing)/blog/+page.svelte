<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/marketing/Seo.svelte';
	import { POSTS } from '#lib/marketing/posts/index.ts';
	import { formatLongDate } from '#lib/marketing/site.ts';
</script>

<Seo
	title="Blog"
	description="Practical articles on journaling and reviewing options trades: R-multiples, fills and multi-leg structures, Greeks and P&L attribution."
	path="/blog"
/>

<header class="page-head container">
	<h1>Blog</h1>
	<p class="lede">
		Notes on measuring options trades properly: risk, fills, structures and the Greeks.
	</p>
</header>

<div class="container">
	<ol class="posts" role="list">
		{#each POSTS as post (post.slug)}
			<li class="row-hover">
				<article aria-labelledby="post-{post.slug}">
					<p class="meta">
						<time datetime={post.date}>{formatLongDate(post.date)}</time>
						<span>{post.readingMinutes} min read</span>
					</p>
					<h2 id="post-{post.slug}">
						<a href={resolve('/(marketing)/blog/[slug]', { slug: post.slug })}>{post.title}</a>
					</h2>
					<p class="desc">{post.description}</p>
					<span class="go hover-reveal" aria-hidden="true">→</span>
				</article>
			</li>
		{/each}
	</ol>
</div>

<style>
	.posts {
		display: grid;
	}

	/* The whole row is the target: the title link stretches over it, and the row tints on intent. */
	.posts li {
		margin-inline: calc(-1 * var(--space-3));
		padding-inline: var(--space-3);
		/* The hairline keeps the text column's width while the hover tint bleeds past it. */
		background-image: linear-gradient(var(--color-line), var(--color-line));
		background-position: center bottom;
		background-repeat: no-repeat;
		background-size: calc(100% - 2 * var(--space-3)) 1px;
	}

	@media (forced-colors: active) {
		.posts li {
			background-image: none;
			border-bottom: 1px solid CanvasText;
		}
	}

	article {
		position: relative;
		display: grid;
		gap: var(--space-3);
		padding: var(--space-8) 0;
	}

	h2 a::after {
		content: '';
		position: absolute;
		inset: 0;
	}

	.go {
		display: none;
		color: var(--color-ink-2);
		font-size: var(--text-lg);
	}

	@media (min-width: 900px) {
		article {
			grid-template-columns: 14rem minmax(0, 1fr);
			column-gap: var(--space-12);
		}

		.meta {
			grid-row: 1 / span 2;
			flex-direction: column;
			gap: var(--space-1);
		}

		.go {
			display: block;
			position: absolute;
			top: var(--space-8);
			right: 0;
		}
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	h2 {
		max-width: 19em;
		font-size: var(--text-xl);
		letter-spacing: var(--tracking-tight);
	}

	h2 a {
		text-decoration: underline;
		text-decoration-color: transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
		transition: text-decoration-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		h2 a:hover {
			text-decoration-color: currentColor;
			transition-delay: var(--hover-delay-tint);
		}
	}

	.desc {
		max-width: 64ch;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}

	@media (min-width: 900px) {
		.desc {
			grid-column: 2;
		}
	}
</style>
