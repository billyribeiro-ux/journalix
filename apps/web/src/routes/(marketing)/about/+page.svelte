<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@journalix/ui';
	import Seo from '#lib/marketing/Seo.svelte';

	const principles = [
		{
			title: 'Your data is yours',
			text: 'Your journal is not sold, not shared with advertisers and not used to train models. You can export all of it at any time and delete it permanently. The desktop app keeps it on your own machine. Market data comes from your own provider account, under your own terms with them.'
		},
		{
			title: 'No guesswork',
			text: 'There are no AI summaries or generated insights. Every number in Journalix comes from your fills and a formula you can look up: average cost, Black-Scholes, a Taylor expansion. Where a figure is an estimate, such as P&L attribution, it says so and shows the part it can’t explain.'
		},
		{
			title: 'Precision over convenience',
			text: 'Fills are recorded with their time, fees and the underlying price, because that is what lets the journal compute implied volatility, Greeks and R honestly. It takes a little longer to log a trade this way. The reviews are worth it.'
		},
		{
			title: 'Say what it doesn’t do',
			text: 'Journalix doesn’t sync with brokers yet, doesn’t place trades and doesn’t give advice. The feature reference lists what exists today, and nothing more.'
		}
	] as const;
</script>

<Seo
	title="About"
	description="Why Journalix exists: trading journals rarely understand multi-leg options. Built by a trader-engineer around fills, precision and data ownership."
	path="/about"
/>

<header class="page-head container">
	<h1>Why Journalix exists</h1>
	<p class="lede">
		Most trading journals were designed for shares. Options traders end up with spreadsheets or with
		tools that flatten a four-leg condor into four unrelated rows.
	</p>
</header>

<div class="container body">
	<section class="prose" data-reveal aria-labelledby="story-title">
		<h2 id="story-title" class="visually-hidden">Background</h2>
		<p>
			A journal is supposed to tell you what you did and whether it worked. For an options trader,
			“what you did” is rarely a single buy and a single sell. It is a credit spread opened in two
			legs, rolled once, closed early on one side. It is a long call scaled into on a pullback and
			scaled out of into strength. It is a short put that got assigned.
		</p>
		<p>
			Journals that think in positions lose that detail. They record an average entry and an average
			exit, and the review that matters (where did I add, where did I take profit, did I move my
			stop) is gone. Their analytics then treat a defined-risk iron condor and a naked short call as
			the same kind of trade.
		</p>
		<p>
			Journalix was built by a trader who also writes software, for the way options are actually
			traded. Trades are made of legs; legs are made of fills; everything else is computed from the
			fills. That one decision is what makes the chart review, the structure detection, the Greeks
			and the R-multiples possible.
		</p>
	</section>

	<section class="principles" data-reveal aria-labelledby="principles-title">
		<h2 id="principles-title">Principles</h2>
		<dl class="spec">
			{#each principles as principle (principle.title)}
				<div>
					<dt>{principle.title}</dt>
					<dd>{principle.text}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section class="status" data-reveal aria-labelledby="status-title">
		<h2 id="status-title">Where things stand</h2>
		<p>
			Journalix is in early access. The journal, chart review, options analysis and analytics
			described on this site are working today, on the web and as a desktop app. Billing isn’t live,
			so every feature is free while we listen to the traders using it. The
			<a href={resolve('changelog')}>changelog</a> records what ships.
		</p>
		<div class="cta-row">
			<Button href={resolve('signup')} variant="primary">Start journaling</Button>
			<Button href={resolve('contact')} variant="secondary">Get in touch</Button>
		</div>
	</section>
</div>

<style>
	.body {
		display: grid;
		gap: var(--space-16);
		padding-top: var(--space-12);
	}

	.principles,
	.status {
		display: grid;
		gap: var(--space-6);
	}

	.principles h2,
	.status h2 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.status p {
		max-width: var(--prose-max);
		color: var(--color-ink-2);
	}
</style>
