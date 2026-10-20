<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@journalix/ui/marketing';
	import { SITE } from '#lib/index.ts';
	import { FOOTER_COLUMNS } from '#lib/marketing/site.ts';
</script>

<footer class="site-footer">
	<div class="inner">
		<div class="brand">
			<a class="home" href={resolve('')} aria-label="Journalix home"><Logo size={24} /></a>
			<p>{SITE.tagline}. Log every leg and fill, review it on the chart, measure what works.</p>
		</div>

		{#each FOOTER_COLUMNS as column (column.title)}
			<nav class="column" aria-label={column.title}>
				<h2>{column.title}</h2>
				<ul role="list">
					{#each column.links as link (link.label)}
						<li><a href={link.href()}>{link.label}</a></li>
					{/each}
				</ul>
			</nav>
		{/each}
	</div>

	<div class="legal">
		<p>
			Not investment advice. Journalix is a record-keeping and analysis tool. It is not a broker,
			dealer or investment adviser, and it does not place trades.
		</p>
		<p>© 2026 {SITE.name}</p>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid var(--color-line);
		background: var(--color-surface);
		margin-top: var(--space-24);
	}

	.inner {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-10) var(--space-6);
		max-width: var(--site-max);
		margin: 0 auto;
		padding: var(--space-16) var(--site-gutter) var(--space-12);
	}

	.brand {
		grid-column: 1 / -1;
		display: grid;
		gap: var(--space-4);
		align-content: start;
	}

	.brand p {
		max-width: 36ch;
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.home {
		display: inline-flex;
		width: fit-content;
		color: var(--color-ink);
		text-decoration: none;
	}

	h2 {
		margin-bottom: var(--space-3);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0;
		color: var(--color-ink);
	}

	ul {
		display: grid;
		gap: var(--space-2);
	}

	.column a {
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		text-decoration: none;
	}

	.column a:hover {
		color: var(--color-ink);
		text-decoration: underline;
	}

	.legal {
		display: grid;
		gap: var(--space-2);
		max-width: var(--site-max);
		margin: 0 auto;
		padding: var(--space-6) var(--site-gutter) var(--space-10);
		border-top: 1px solid var(--color-line);
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}

	.legal p:first-child {
		max-width: var(--prose-max);
	}

	@media (min-width: 720px) {
		.inner {
			grid-template-columns: 2fr repeat(3, minmax(0, 1fr));
		}

		.brand {
			grid-column: auto;
		}

		.legal {
			grid-template-columns: 1fr auto;
			align-items: end;
			gap: var(--space-8);
		}
	}
</style>
