<script lang="ts">
	import { page } from '$app/state';
	import { SITE } from '#lib/index.ts';
	import { jsonLdText } from '#lib/marketing/json-ld.ts';

	interface Props {
		/** Page title without the site suffix. Omit on the home page. */
		title?: string;
		description: string;
		/** Canonical path, e.g. `/pricing`. Defaults to the current pathname. */
		path?: string;
		type?: 'website' | 'article';
		/** ISO date for articles. */
		published?: string;
		/** Structured data objects, each rendered as its own JSON-LD script. */
		jsonLd?: readonly Record<string, unknown>[];
		noindex?: boolean;
	}

	let {
		title,
		description,
		path,
		type = 'website',
		published,
		jsonLd = [],
		noindex = false
	}: Props = $props();

	const fullTitle = $derived(title ? `${title} — ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`);
	const canonical = $derived(`${page.url.origin}${path ?? page.url.pathname}`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}

	<meta property="og:site_name" content={SITE.name} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:locale" content="en_US" />
	{#if type === 'article' && published}
		<meta property="article:published_time" content={published} />
	{/if}

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />

	{#each jsonLd as data, index (index)}
		<svelte:element this={"script"} type="application/ld+json">{jsonLdText(data)}</svelte:element>
	{/each}
</svelte:head>
