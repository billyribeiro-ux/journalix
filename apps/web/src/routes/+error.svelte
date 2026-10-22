<script lang="ts">
	import '#lib/marketing/marketing.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '@journalix/ui';
	import { Logo } from '@journalix/ui/marketing';
	import { SITE } from '#lib/index.ts';

	const notFound = $derived(page.status === 404);
	const heading = $derived(notFound ? 'This page doesn’t exist' : 'Something went wrong');
	const detail = $derived(
		notFound
			? 'The address may be mistyped, or the page may have moved.'
			: 'The server couldn’t complete the request. Try again in a moment; if it keeps happening, let us know what you were doing.'
	);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Error'} — {SITE.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mk">
	<header class="container top">
		<a class="home" href={resolve('')} aria-label="Journalix home"><Logo size={26} /></a>
	</header>
	<main id="main" class="container error" tabindex="-1">
		<p class="status num">Error {page.status}</p>
		<h1>{heading}</h1>
		<p class="lede">{detail}</p>
		{#if !notFound && page.error?.message}
			<p class="note">{page.error.message}</p>
		{/if}
		<div class="cta-row">
			<Button href={resolve('')} variant="primary">Go to the home page</Button>
			<Button href={resolve('app')} variant="secondary">Open the app</Button>
			{#if !notFound}
				<Button href={resolve('contact')} variant="ghost">Report a problem</Button>
			{/if}
		</div>
		{#if notFound}
			<nav aria-label="Popular pages">
				<ul role="list">
					<li><a href={resolve('features')}>Features</a></li>
					<li><a href={resolve('options')}>For options traders</a></li>
					<li><a href={resolve('pricing')}>Pricing</a></li>
					<li><a href={resolve('blog')}>Blog</a></li>
				</ul>
			</nav>
		{/if}
	</main>
</div>

<style>
	.top {
		padding-top: var(--space-6);
	}

	.home {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--color-ink);
		text-decoration: none;
	}

	main:focus {
		outline: none;
	}

	.error {
		display: grid;
		gap: var(--space-5);
		align-content: start;
		padding-top: 12vh;
		padding-bottom: var(--space-16);
	}

	/* The status code is the one number on the page; set it as a tabular figure with a rule. */
	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.status::before {
		content: '';
		width: var(--space-6);
		height: 1px;
		background: var(--color-ink-3);
	}

	h1 {
		max-width: 9em;
		font-size: clamp(var(--text-3xl), 6vw, var(--text-5xl));
		line-height: 1.04;
		letter-spacing: var(--tracking-display);
	}

	.lede {
		max-width: 52ch;
	}

	nav {
		margin-top: var(--space-8);
		padding-top: var(--space-6);
		border-top: 1px solid var(--color-line);
		max-width: 40rem;
	}

	nav ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
	}

	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		color: var(--color-ink-2);
		font-weight: 500;
		text-underline-offset: 0.22em;
		text-decoration-color: transparent;
		text-decoration-line: underline;
		transition:
			color var(--duration-fast) var(--ease-out),
			text-decoration-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		nav a:hover {
			color: var(--color-ink);
			text-decoration-color: currentColor;
			transition-delay: var(--hover-delay-tint);
		}
	}

	nav a:focus-visible,
	nav a:active {
		transition-delay: 0s;
	}

	@media (pointer: coarse) {
		nav a {
			min-height: var(--control-touch);
		}
	}
</style>
