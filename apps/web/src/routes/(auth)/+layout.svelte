<script lang="ts">
	import '#lib/marketing/marketing.css';
	import { Logo } from '@journalix/ui/marketing';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="auth auth-shell">
	<header>
		<a href={resolve('')} class="home" aria-label="Journalix home"><Logo /></a>
	</header>
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
	<footer>
		<p>Not investment advice. Journalix is a journal, not a broker or advisor.</p>
	</footer>
</div>

<style>
	.auth {
		position: relative;
		isolation: isolate;
		min-height: 100dvh;
		display: grid;
		grid-template-rows: auto 1fr auto;
		padding: var(--space-6) var(--space-4);
		background: var(--color-bg);
	}

	/* Ruled drafting paper that fades out toward the footer, so the legal line never sits on a rule. */
	.auth::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(var(--color-line) 1px, transparent 1px) 0 0 / 100% 48px;
		mask-image: linear-gradient(to bottom, var(--color-ink) 30%, transparent 90%);
		pointer-events: none;
	}

	header {
		max-width: 400px;
		width: 100%;
		margin: 0 auto;
	}

	.home {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		text-decoration: none;
		color: var(--color-ink);
	}

	main:focus {
		outline: none;
	}

	main {
		display: grid;
		place-items: start center;
		padding-top: var(--space-12);
	}

	footer {
		text-align: center;
		color: var(--color-ink-3);
		font-size: var(--text-xs);
		text-wrap: pretty;
	}

	@media (min-width: 720px) {
		main {
			padding-top: 12vh;
		}
	}
</style>
