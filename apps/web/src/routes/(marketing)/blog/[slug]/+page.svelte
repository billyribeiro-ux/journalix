<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '@strikebook/ui';
	import { SITE } from '#lib/index.ts';
	import Seo from '#lib/marketing/Seo.svelte';
	import PostBody from '#lib/marketing/PostBody.svelte';
	import { POSTS } from '#lib/marketing/posts/index.ts';
	import { formatLongDate } from '#lib/marketing/site.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const post = $derived(data.post);
	const path = $derived(`/blog/${post.slug}`);
	const others = $derived(POSTS.filter((p) => p.slug !== post.slug));

	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: post.title,
			description: post.description,
			datePublished: post.date,
			dateModified: post.date,
			mainEntityOfPage: `${page.url.origin}${path}`,
			author: { '@type': 'Organization', name: SITE.name, url: `${page.url.origin}/` },
			publisher: { '@type': 'Organization', name: SITE.name, url: `${page.url.origin}/` }
		}
	]);
</script>

<Seo
	title={post.title}
	description={post.description}
	{path}
	type="article"
	published={post.date}
	{jsonLd}
/>

<article class="container post" aria-labelledby="post-title">
	<header class="post-head">
		<p class="back"><a href={resolve('blog')}>Blog</a></p>
		<h1 id="post-title">{post.title}</h1>
		<p class="lede">{post.description}</p>
		<p class="meta">
			<time datetime={post.date}>{formatLongDate(post.date)}</time>
			<span>{post.readingMinutes} min read</span>
		</p>
	</header>

	<PostBody blocks={post.body} />

	<aside class="post-cta" aria-labelledby="post-cta-title">
		<h2 id="post-cta-title">Measure your own trades this way</h2>
		<p>
			Strikebook records every leg and fill and computes these numbers for you. Free during early
			access.
		</p>
		<div class="cta-row">
			<Button href={resolve('signup')} variant="primary">Start journaling</Button>
		</div>
	</aside>
</article>

<nav class="container more" aria-labelledby="more-title">
	<h2 id="more-title">More articles</h2>
	<ul role="list">
		{#each others as other (other.slug)}
			<li>
				<a href={resolve('/(marketing)/blog/[slug]', { slug: other.slug })}>{other.title}</a>
				<span class="note">{formatLongDate(other.date)}</span>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.post {
		padding-top: var(--space-12);
	}

	.post-head {
		display: grid;
		gap: var(--space-5);
		max-width: 52rem;
		padding-bottom: var(--space-10);
		margin-bottom: var(--space-10);
		border-bottom: 1px solid var(--color-line);
	}

	.back a {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	h1 {
		font-size: clamp(var(--text-2xl), 5vw, var(--text-4xl));
		line-height: 1.08;
		letter-spacing: var(--tracking-display);
	}

	.lede {
		max-width: 60ch;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.post-cta {
		display: grid;
		gap: var(--space-3);
		max-width: var(--prose-max);
		margin-top: var(--space-16);
		padding: var(--space-6);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.post-cta h2 {
		font-size: var(--text-lg);
	}

	.post-cta p {
		color: var(--color-ink-2);
	}

	.more {
		padding-top: var(--space-16);
	}

	.more h2 {
		font-size: var(--text-lg);
		margin-bottom: var(--space-4);
	}

	.more ul {
		display: grid;
		max-width: var(--prose-max);
		border-top: 1px solid var(--color-line);
	}

	.more li {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.more a {
		font-weight: 500;
	}
</style>
