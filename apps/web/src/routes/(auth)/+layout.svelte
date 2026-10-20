<script lang="ts">
	import { Logo } from '@journalix/ui/marketing';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="auth">
	<header>
		<a href={resolve('')} class="home" aria-label="Journalix home"><Logo /></a>
	</header>
	<main id="main">
		{@render children()}
	</main>
	<footer>
		<p>Not investment advice. Journalix is a journal, not a broker or advisor.</p>
	</footer>
</div>

<style>
	.auth {
		min-height: 100dvh;
		display: grid;
		grid-template-rows: auto 1fr auto;
		padding: var(--space-6) var(--space-4);
		background:
			linear-gradient(var(--color-line) 1px, transparent 1px) 0 0 / 100% 48px,
			var(--color-bg);
	}

	header {
		max-width: 400px;
		width: 100%;
		margin: 0 auto;
	}

	.home {
		display: inline-flex;
		text-decoration: none;
		color: var(--color-ink);
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
	}

	@media (min-width: 720px) {
		main {
			padding-top: 12vh;
		}
	}
</style>
