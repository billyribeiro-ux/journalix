<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '@journalix/ui';
	import { formatMoney, formatPrice } from '@journalix/core';
	import { SITE } from '#lib/index.ts';
	import Seo from '#lib/marketing/Seo.svelte';
	import HeroChart from '#lib/marketing/HeroChart.svelte';
	import PayoffDiagram from '#lib/marketing/PayoffDiagram.svelte';
	import {
		IRON_CONDOR,
		IRON_CONDOR_CREDIT,
		IRON_CONDOR_PROFILE
	} from '#lib/marketing/payoff-example.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const steps = [
		{
			title: 'Log',
			text: 'Enter the trade the way it happened, one execution at a time.',
			details: [
				'Entries, adds, partial exits and full exits as separate fills',
				'Time, price, quantity, fees and the underlying price at each fill',
				'Stops and targets you can move, with every move kept',
				'Thesis, review, rating, playbook and tags'
			]
		},
		{
			title: 'Review',
			text: 'Open the trade and see it drawn on the chart of the underlying.',
			details: [
				'Entry, add and exit markers at the exact time and price',
				'Stop and target lines with their full history',
				'Risk and reward zones from your planned levels',
				'Running P&L across the life of the position'
			]
		},
		{
			title: 'Measure',
			text: 'Every report is computed from the same fills, so the numbers agree.',
			details: [
				'Equity curve, drawdown and a daily P&L calendar',
				'R-multiples, expectancy, profit factor and SQN',
				'Breakdowns by strategy, DTE, setup, tag and time of day',
				'Global filters that apply to every page at once'
			]
		}
	] as const;

	const optionPoints = [
		{
			title: 'Structures, detected',
			text: 'Verticals, iron condors, butterflies, straddles, strangles, calendars, diagonals, covered calls, collars and more: over 30 structures named automatically from the legs you enter.'
		},
		{
			title: 'Risk from the structure',
			text: 'Max profit, max loss and breakevens are computed from the strikes and premiums, and defined-risk trades get an R-multiple without you entering a stop.'
		},
		{
			title: 'IV and Greeks from your fills',
			text: 'Implied volatility is solved from each fill price and the underlying price you recorded, then delta, gamma, theta and vega are computed at entry.'
		},
		{
			title: 'Where the P&L came from',
			text: 'An estimated attribution splits a closed trade’s result into delta, gamma, theta and vega, with the unexplained remainder shown separately.'
		}
	] as const;

	const metricGroups = [
		{
			title: 'Performance',
			items: [
				'Net and gross P&L',
				'Win rate',
				'Profit factor',
				'Expectancy',
				'Average win and loss'
			]
		},
		{
			title: 'Risk',
			items: [
				'R-multiple distribution',
				'SQN',
				'Sharpe and Sortino',
				'Max drawdown',
				'Equity curve'
			]
		},
		{
			title: 'Options',
			items: ['DTE at entry', 'Credit vs debit', 'Expiry outcome', 'Strategy', 'Premium captured']
		},
		{
			title: 'Behaviour',
			items: [
				'Weekday and hour',
				'Holding time',
				'Setup and playbook',
				'Mistake tags',
				'P&L calendar'
			]
		}
	] as const;

	const condorDescription = `Payoff of a ${IRON_CONDOR.symbol} iron condor with ${IRON_CONDOR.dte} days to expiry: long 630 put, short 640 put, short 705 call, long 715 call, opened for a ${formatPrice(IRON_CONDOR_CREDIT)} credit. Maximum profit ${formatMoney(IRON_CONDOR_PROFILE.maxProfit, { digits: 0 })}, maximum loss ${formatMoney(IRON_CONDOR_PROFILE.maxLoss, { digits: 0 })}, breakevens at ${IRON_CONDOR_PROFILE.breakevens.map((b) => formatPrice(b)).join(' and ')}.`;

	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: SITE.name,
			description: SITE.description,
			applicationCategory: 'FinanceApplication',
			operatingSystem: 'Web, macOS, Windows, Linux',
			url: `${page.url.origin}/`,
			offers: {
				'@type': 'Offer',
				name: 'Starter',
				price: '0',
				priceCurrency: 'USD'
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: SITE.name,
			url: `${page.url.origin}/`,
			logo: `${page.url.origin}/favicon.svg`
		}
	]);
</script>

<Seo description={SITE.description} path="/" {jsonLd} />

<section class="hero container" aria-labelledby="hero-title">
	<div class="hero-copy">
		<!-- Each sentence is one unbreakable unit, so the line breaks fall between ideas, not mid-phrase. -->
		<h1 id="hero-title">
			<span>Every leg.</span> <span>Every fill.</span> <span>On the chart.</span>
		</h1>
		<p class="lede">
			Journalix is a trading journal built around options. Log each execution as it happened, review
			the trade drawn on the chart, and measure your results with analytics that understand
			multi-leg positions.
		</p>
		<div class="cta-row">
			<Button href={resolve('signup')} variant="primary">Start journaling</Button>
			<Button href="#how-it-works" variant="secondary">See how it works</Button>
		</div>
		<p class="note">Free during early access. No card required.</p>
		<dl class="hero-facts">
			<div>
				<dt>Structures</dt>
				<dd>30+ detected</dd>
			</div>
			<div>
				<dt>Greeks</dt>
				<dd>Solved from fills</dd>
			</div>
			<div>
				<dt>Platforms</dt>
				<dd>Web and desktop</dd>
			</div>
		</dl>
	</div>
	<div class="hero-figure">
		<HeroChart demo={data.demo} />
	</div>
</section>

<section id="how-it-works" class="section container" aria-labelledby="how-title">
	<div class="section-head">
		<h2 id="how-title" class="display">Log it, review it, measure it</h2>
		<p class="lede">
			A journal is only as useful as the record behind it. Journalix keeps the record at the level
			of individual fills and builds everything else from there.
		</p>
	</div>
	<ol class="steps" role="list">
		{#each steps as step, index (step.title)}
			<li>
				<span class="step-no num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
				<h3>{step.title}</h3>
				<p>{step.text}</p>
				<ul role="list">
					{#each step.details as detail (detail)}
						<li>{detail}</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ol>
</section>

<section class="section container" aria-labelledby="options-title">
	<div class="split">
		<div>
			<h2 id="options-title" class="display">Built for the way options trade</h2>
			<p class="lede">
				A spread is one trade, not four unrelated rows. Journalix keeps the legs together and
				computes the numbers an options trader actually checks.
			</p>
			<dl class="points">
				{#each optionPoints as point (point.title)}
					<div>
						<dt>{point.title}</dt>
						<dd>{point.text}</dd>
					</div>
				{/each}
			</dl>
			<p class="more"><a href={resolve('options')}>Read how options trades are recorded</a></p>
		</div>
		<div class="figure-panel">
			<p class="figure-title">
				<span>{IRON_CONDOR.symbol} iron condor 630/640/705/715</span>
				<span class="muted num"
					>{IRON_CONDOR.dte} DTE, {formatPrice(IRON_CONDOR_CREDIT)} credit</span
				>
			</p>
			<PayoffDiagram
				legs={IRON_CONDOR.legs}
				range={IRON_CONDOR.range}
				spot={IRON_CONDOR.spot}
				rate={IRON_CONDOR.rate}
				title="Iron condor payoff"
				description={condorDescription}
			/>
			<dl class="figure-stats">
				<div>
					<dt>Max profit</dt>
					<dd class="num gain">{formatMoney(IRON_CONDOR_PROFILE.maxProfit, { digits: 0 })}</dd>
				</div>
				<div>
					<dt>Max loss</dt>
					<dd class="num loss">{formatMoney(IRON_CONDOR_PROFILE.maxLoss, { digits: 0 })}</dd>
				</div>
				<div>
					<dt>Breakevens</dt>
					<dd class="num">
						{IRON_CONDOR_PROFILE.breakevens.map((b) => formatPrice(b)).join(' / ')}
					</dd>
				</div>
			</dl>
		</div>
	</div>
</section>

<section class="section container" aria-labelledby="analytics-title">
	<div class="section-head">
		<h2 id="analytics-title" class="display">Analytics that answer specific questions</h2>
		<p class="lede">
			Do your 0DTE trades pay for themselves? Is your edge in credit or debit structures? Which
			mistake tag costs the most? Every breakdown filters by account, date, strategy, playbook and
			tag.
		</p>
	</div>
	<div class="metric-grid">
		{#each metricGroups as group (group.title)}
			<div class="metric-group">
				<h3>{group.title}</h3>
				<ul role="list">
					{#each group.items as item (item)}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
	<p class="more"><a href={resolve('features')}>See the full feature reference</a></p>
</section>

<section class="section container" aria-labelledby="data-title">
	<div class="split even">
		<div>
			<h2 id="data-title" class="display">Your data, your market data</h2>
		</div>
		<div class="stack">
			<div class="fact">
				<h3>Bring your own data provider</h3>
				<p>
					Candles come from your own account with Massive (formerly Polygon), Alpaca, Databento or
					Tiingo. Add the key in Settings; it is encrypted at rest and used only to fetch bars for
					your charts. A built-in simulator draws demo charts without any key.
				</p>
			</div>
			<div class="fact">
				<h3>Nothing is sold or shared</h3>
				<p>
					Your journal is not used for advertising, not sold, and not used to train models. You can
					export all of it at any time and delete it permanently.
				</p>
			</div>
			<div class="fact">
				<h3>Local on the desktop</h3>
				<p>
					The desktop app keeps the whole journal in a SQLite database on your own machine, so your
					trades stay on hardware you control.
				</p>
			</div>
		</div>
	</div>
</section>

<section class="section container" aria-labelledby="platforms-title">
	<div class="platforms">
		<h2 id="platforms-title" class="display">In the browser or on your desk</h2>
		<div class="platform-cols">
			<div>
				<h3>Web app</h3>
				<p>
					Sign in from any browser. Your journal is stored on our servers, tied to your account, and
					available wherever you trade.
				</p>
			</div>
			<div>
				<h3>Desktop app</h3>
				<p>
					A native app for macOS, Windows and Linux with the same screens and the same analytics,
					keeping everything in a local database.
				</p>
			</div>
		</div>
	</div>
</section>

<section class="section container" aria-labelledby="cta-title">
	<div class="final-cta">
		<h2 id="cta-title" class="display">Start with your last ten trades</h2>
		<p class="lede">
			Log them leg by leg and look at them on the chart. Most traders learn something from the first
			review.
		</p>
		<div class="cta-row">
			<Button href={resolve('signup')} variant="primary">Start journaling</Button>
			<Button href={resolve('pricing')} variant="secondary">View plans</Button>
		</div>
	</div>
</section>

<style>
	.hero {
		display: grid;
		gap: var(--space-10);
		padding-top: var(--space-12);
	}

	.hero-copy {
		display: grid;
		gap: var(--space-6);
		align-content: start;
	}

	.hero h1 {
		/* Deliberately no max-width in ch: the width of "0" differs between the web font and its
		   fallback, which moved a line break and shifted the page (measured 0.158 CLS at 390px). */
		font-size: clamp(2.5rem, 7.5vw, 4.75rem);
		font-weight: 600;
		line-height: 0.98;
		letter-spacing: var(--tracking-display);
	}

	.hero h1 span {
		display: inline-block;
	}

	.hero .lede {
		max-width: 46ch;
	}

	.hero-facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3) var(--space-4);
		max-width: 30rem;
		margin-top: var(--space-2);
		padding-top: var(--space-5);
		border-top: 1px solid var(--color-line);
	}

	.hero-facts dt {
		color: var(--color-ink-3);
		font-size: var(--text-xs);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.hero-facts dd {
		margin-top: 2px;
		color: var(--color-ink);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.hero-figure {
		min-width: 0;
	}

	.section-head {
		display: grid;
		gap: var(--space-5);
		max-width: 52rem;
		margin-bottom: var(--space-10);
	}

	.section-head .lede {
		max-width: 60ch;
	}

	.steps {
		display: grid;
		border-top: 1px solid var(--color-ink);
	}

	.steps > li {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		padding: var(--space-6) 0 var(--space-8);
		border-bottom: 1px solid var(--color-line);
	}

	.step-no {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.steps h3 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.steps p {
		color: var(--color-ink-2);
	}

	.steps ul,
	.metric-group ul {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
		font-size: var(--text-base);
		color: var(--color-ink-2);
	}

	.steps ul li,
	.metric-group li {
		padding-left: var(--space-4);
		position: relative;
	}

	.steps ul li::before,
	.metric-group li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.7em;
		width: 6px;
		height: 1px;
		background: var(--color-ink-3);
	}

	.split {
		display: grid;
		gap: var(--space-10);
	}

	.split .lede {
		margin-top: var(--space-5);
		max-width: 52ch;
	}

	.points {
		display: grid;
		gap: var(--space-6);
		margin-top: var(--space-8);
	}

	.points dt {
		font-weight: 600;
		color: var(--color-ink);
	}

	.points dd {
		margin-top: var(--space-1);
		color: var(--color-ink-2);
		max-width: 56ch;
	}

	.more {
		margin-top: var(--space-8);
	}

	.figure-panel {
		display: grid;
		gap: var(--space-4);
		align-content: start;
		padding: var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		min-width: 0;
	}

	.figure-title {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-1) var(--space-4);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.figure-title .muted {
		font-weight: 400;
	}

	.figure-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.figure-stats dt {
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}

	.figure-stats dd {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		border-top: 1px solid var(--color-ink);
	}

	.metric-group {
		padding: var(--space-6) var(--space-6) var(--space-6) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.metric-group h3 {
		font-size: var(--text-lg);
	}

	.stack {
		display: grid;
		border-top: 1px solid var(--color-ink);
	}

	.fact {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-6) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.fact h3,
	.platform-cols h3 {
		font-size: var(--text-lg);
	}

	.fact p,
	.platform-cols p {
		color: var(--color-ink-2);
		max-width: 60ch;
	}

	.platforms {
		display: grid;
		gap: var(--space-8);
		padding: var(--space-10) 0;
		border-top: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
	}

	.platform-cols {
		display: grid;
		gap: var(--space-8);
	}

	.platform-cols > div {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.final-cta {
		display: grid;
		gap: var(--space-6);
		padding-top: var(--space-10);
		border-top: 2px solid var(--color-ink);
	}

	.final-cta .lede {
		max-width: 50ch;
	}

	@media (min-width: 720px) {
		.hero {
			padding-top: var(--space-16);
		}

		.steps {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			border-bottom: 1px solid var(--color-line);
		}

		.steps > li {
			padding-right: var(--space-8);
			border-bottom: 0;
		}

		.steps > li + li {
			padding-left: var(--space-8);
			border-left: 1px solid var(--color-line);
		}

		.platforms {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
			gap: var(--space-12);
		}

		.platform-cols {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1040px) {
		.hero {
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			gap: var(--space-12);
			align-items: start;
		}

		.hero-copy {
			padding-top: var(--space-8);
		}

		.split {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: var(--space-16);
			align-items: start;
		}

		.split.even {
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		}
	}
</style>
