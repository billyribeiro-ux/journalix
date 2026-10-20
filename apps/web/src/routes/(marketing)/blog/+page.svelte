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
			<li>
				<article aria-labelledby="post-{post.slug}">
					<p class="meta">
						<time datetime={post.date}>{formatLongDate(post.date)}</time>
						<span>{post.readingMinutes} min read</span>
					</p>
					<h2 id="post-{post.slug}">
						<a href={resolve('/(marketing)/blog/[slug]', { slug: post.slug })}>{post.title}</a>
					</h2>
					<p class="desc">{post.description}</p>
				</article>
			</li>
		{/each}
	</ol>
</div>

<style>
	.posts {
		display: grid;
	}

	.posts li {
		border-bottom: 1px solid var(--color-line);
	}

	article {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-8) 0;
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
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	h2 {
		max-width: 32ch;
		font-size: var(--text-xl);
		letter-spacing: var(--tracking-tight);
	}

	h2 a {
		text-decoration: none;
	}

	h2 a:hover {
		text-decoration: underline;
	}

	.desc {
		max-width: 64ch;
		color: var(--color-ink-2);
	}

	@media (min-width: 900px) {
		.desc {
			grid-column: 2;
		}
	}
</style>
