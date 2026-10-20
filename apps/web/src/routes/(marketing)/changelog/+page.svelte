<script lang="ts">
	import Seo from '#lib/marketing/Seo.svelte';
	import { formatLongDate } from '#lib/marketing/site.ts';

	interface Release {
		readonly version: string;
		readonly date: string;
		readonly summary: string;
		readonly sections: readonly { readonly title: string; readonly items: readonly string[] }[];
	}

	const releases: readonly Release[] = [
		{
			version: '0.1.0',
			date: '2026-10-20',
			summary:
				'The first early-access release: the full journal, chart review, options analysis and analytics, on the web and as a desktop app.',
			sections: [
				{
					title: 'Journal',
					items: [
						'Manual trade entry by leg and execution: entries, adds, partial exits and exits, each with time, price, quantity, fees and underlying price.',
						'Stops and targets that can be moved, with every change kept.',
						'Thesis, review, rating and confidence on each trade.',
						'Stocks, options and futures legs with per-leg multipliers.'
					]
				},
				{
					title: 'Chart review',
					items: [
						'Trade chart with entry, add and exit markers, long and short.',
						'Stop and target lines with their history, risk and reward zones and running P&L.',
						'Automatic timeframe and window based on holding time.'
					]
				},
				{
					title: 'Options',
					items: [
						'Detection of more than 30 structures, from singles and verticals to condors, butterflies, calendars, diagonals and collars.',
						'OCC symbols for every option leg.',
						'Expiration, assignment and exercise as distinct executions.',
						'Max profit, max loss and breakevens; payoff diagrams at expiry and today.',
						'Implied volatility and Greeks solved from fills; estimated P&L attribution.'
					]
				},
				{
					title: 'Analytics',
					items: [
						'Equity curve with drawdown, P&L calendar and core statistics.',
						'R-multiples, R distribution, expectancy, profit factor and SQN.',
						'Sharpe, Sortino and Calmar ratios.',
						'Breakdowns by strategy, DTE at entry, weekday, hour, holding time, setup, tag, credit vs debit and expiry outcome.'
					]
				},
				{
					title: 'Organisation',
					items: [
						'Playbooks with rules; setup, mistake, emotion and market tags.',
						'Daily notebook for pre-market plans, recaps and lessons.',
						'Multiple accounts and global filters across every report.'
					]
				},
				{
					title: 'Data and platforms',
					items: [
						'Market data from your own Massive, Alpaca, Databento or Tiingo key, encrypted at rest.',
						'Built-in simulator for demo charts.',
						'Journal export as JSON.',
						'Desktop app for macOS, Windows and Linux with a local SQLite database.'
					]
				}
			]
		}
	];
</script>

<Seo
	title="Changelog"
	description="What has shipped in Strikebook, release by release."
	path="/changelog"
/>

<header class="page-head container">
	<h1>Changelog</h1>
	<p class="lede">What has shipped, release by release.</p>
</header>

<div class="container">
	{#each releases as release (release.version)}
		<article class="release" aria-labelledby="v-{release.version}">
			<div class="release-meta">
				<h2 id="v-{release.version}">Version {release.version}</h2>
				<p><time datetime={release.date}>{formatLongDate(release.date)}</time></p>
			</div>
			<div class="release-body">
				<p class="summary">{release.summary}</p>
				{#each release.sections as section (section.title)}
					<section aria-label={section.title}>
						<h3>{section.title}</h3>
						<ul>
							{#each section.items as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</article>
	{/each}
</div>

<style>
	.release {
		display: grid;
		gap: var(--space-6);
		padding-top: var(--space-10);
	}

	.release-meta h2 {
		font-size: var(--text-xl);
	}

	.release-meta p {
		margin-top: var(--space-1);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.release-body {
		display: grid;
		gap: var(--space-8);
		max-width: var(--prose-max);
	}

	.summary {
		color: var(--color-ink);
		font-size: var(--text-lg);
	}

	h3 {
		font-size: var(--text-md);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}

	ul {
		display: grid;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding-left: var(--space-5);
		color: var(--color-ink-2);
	}

	@media (min-width: 900px) {
		.release {
			grid-template-columns: 14rem minmax(0, 1fr);
			gap: var(--space-12);
		}
	}
</style>
