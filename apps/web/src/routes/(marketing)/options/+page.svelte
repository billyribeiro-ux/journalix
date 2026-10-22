<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@journalix/ui';
	import {
		STRATEGIES,
		formatMoney,
		formatOcc,
		formatPrice,
		type StrategyKind
	} from '@journalix/core';
	import Seo from '#lib/marketing/Seo.svelte';
	import PayoffDiagram from '#lib/marketing/PayoffDiagram.svelte';
	import {
		IRON_CONDOR,
		IRON_CONDOR_CREDIT,
		IRON_CONDOR_PROFILE
	} from '#lib/marketing/payoff-example.ts';

	type Family =
		'single' | 'vertical' | 'volatility' | 'condor' | 'butterfly' | 'time' | 'stock-hedge';

	const families: readonly {
		readonly id: Family;
		readonly title: string;
		readonly note: string;
	}[] = [
		{ id: 'single', title: 'Singles', note: 'One option leg, long or short.' },
		{ id: 'vertical', title: 'Verticals', note: 'Same expiry, two strikes, debit or credit.' },
		{ id: 'volatility', title: 'Volatility', note: 'Calls and puts together, long or short.' },
		{ id: 'condor', title: 'Condors', note: 'Four legs, two spreads, one expiry.' },
		{ id: 'butterfly', title: 'Butterflies', note: 'Three strikes, including iron flies.' },
		{ id: 'time', title: 'Time spreads', note: 'Different expiries, same or different strikes.' },
		{ id: 'stock-hedge', title: 'Stock and options', note: 'Shares paired with options.' }
	];

	const byFamily = (family: Family): string[] =>
		(Object.keys(STRATEGIES) as StrategyKind[])
			.filter((k) => STRATEGIES[k].family === family)
			.map((k) => STRATEGIES[k].label);

	const occExample = formatOcc({
		underlying: 'SPY',
		expiration: '2026-12-18',
		kind: 'call',
		strike: 680
	});

	const recording = [
		{
			term: 'Legs',
			detail:
				'A trade holds one or more legs. Each leg is a contract (underlying, call or put, strike, expiry, multiplier) or shares. Legs are entered once and every fill references one.'
		},
		{
			term: 'Fills',
			detail:
				'Each execution records side, quantity, price per share, fees, the time, and the underlying price at that moment. Opening a spread is one fill per leg at the same time, which is what your broker reports.'
		},
		{
			term: 'Adds and partial exits',
			detail:
				'Adding contracts is another opening fill; taking some off is a closing fill for part of the size. Average cost and realized P&L update per leg as fills are replayed in order.'
		},
		{
			term: 'Legging in and out',
			detail:
				'Open the short put today and the long put tomorrow, or close one side of a condor early. The structure is identified from the full opening size of each leg, so legging doesn’t change what the trade is.'
		},
		{
			term: 'Expiration',
			detail:
				'Close a leg with an expiration record at zero instead of a fake fill. The trade is reported as expired worthless in expiry-outcome analytics.'
		},
		{
			term: 'Assignment and exercise',
			detail:
				'Record that a short option was assigned or a long option exercised. The option leg is closed by an assignment or exercise record paired with the stock execution it produced, and the outcome is reported separately from ordinary closes.'
		}
	] as const;

	const analysis = [
		{
			term: 'Max profit and max loss',
			detail:
				'Computed from the strikes and opening premiums. The payoff is piecewise linear with kinks at the strikes, so the extremes are checked exactly rather than sampled. Unlimited cases are reported as unlimited.'
		},
		{
			term: 'Breakevens',
			detail:
				'Every price where the expiry payoff crosses zero, including both sides of a condor or straddle.'
		},
		{
			term: 'R-multiple without a stop',
			detail:
				'For defined-risk structures, the max loss is used as 1R when you haven’t entered planned risk. You can always override it with your own planned risk.'
		},
		{
			term: 'Payoff at expiry and today',
			detail:
				'The expiry line is exact. The today line values each leg with Black-Scholes at the remaining time and the implied volatility from your fill.'
		},
		{
			term: 'Implied volatility',
			detail:
				'Solved from each option fill price, the recorded underlying price, the strike, time to expiry and your risk-free rate setting.'
		},
		{
			term: 'Greeks at entry',
			detail:
				'Delta, gamma, theta and vega per leg and summed for the position: delta and gamma in share equivalents, theta in dollars per calendar day, vega in dollars per volatility point.'
		},
		{
			term: 'P&L attribution',
			detail:
				'A closed trade’s gross P&L is split into delta, gamma, theta and vega estimates using a Taylor expansion around entry: delta and gamma for the underlying move, theta for time and vega for the change in implied volatility. The residual (higher-order effects, path and fill quality) is shown rather than hidden.'
		}
	] as const;

	const reports = [
		{
			term: 'DTE at entry',
			detail:
				'Results bucketed by days to the nearest expiry at the first fill: 0 DTE, 1 DTE, 2–7, 8–21, 22–45, 46–90 and 90+.'
		},
		{
			term: 'Expiry outcome',
			detail: 'Closed early, expired, or assigned and exercised, with win rate and P&L for each.'
		},
		{
			term: 'Credit vs debit',
			detail: 'Compare trades opened for a credit with those opened for a debit.'
		},
		{
			term: 'Strategy and bias',
			detail:
				'Every structure, and every bias (bullish, bearish, neutral, long volatility), with its own win rate, expectancy and R.'
		},
		{
			term: 'Premium captured',
			detail: 'For credit trades, the share of the opening credit you kept.'
		}
	] as const;

	const condorDescription = `Payoff of a SPY iron condor at expiry and one week after entry. Maximum profit ${formatMoney(IRON_CONDOR_PROFILE.maxProfit, { digits: 0 })} between the short strikes, maximum loss ${formatMoney(IRON_CONDOR_PROFILE.maxLoss, { digits: 0 })} beyond the long strikes.`;
</script>

<Seo
	title="For options traders"
	description="How Journalix records multi-leg options trades: legs and fills, adds, legging, assignment and expiration, OCC symbols, payoff diagrams, IV, Greeks, P&L attribution and DTE analytics."
	path="/options"
/>

<header class="page-head container">
	<h1>A journal that knows what a spread is</h1>
	<p class="lede">
		Most journals were built for shares and treat an iron condor as four unrelated rows. Journalix
		was built around legs and fills from the start, so a multi-leg trade is recorded, charted and
		measured as one position.
	</p>
	<div class="cta-row head-cta">
		<Button href={resolve('signup')} variant="primary">Start journaling</Button>
	</div>
</header>

<section class="container block" data-reveal aria-labelledby="structures-title">
	<div class="block-head">
		<h2 id="structures-title">Supported structures</h2>
		<p>
			The structure is detected from the legs you enter. Matching is exact: legs must line up by
			type, expiry, strike order and ratio. Anything that doesn’t match a named structure is kept as
			a custom or ratio spread with the same analytics.
		</p>
	</div>
	<div class="families">
		{#each families as family (family.id)}
			<section class="family" data-reveal aria-labelledby="family-{family.id}">
				<h3 id="family-{family.id}">{family.title}</h3>
				<p class="note">{family.note}</p>
				<ul role="list">
					{#each byFamily(family.id) as label (label)}
						<li>{label}</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
	<p class="note after">
		Shares (long and short), futures (long and short), ratio spreads and custom structures are also
		supported.
	</p>
</section>

<section class="container block" data-reveal aria-labelledby="recording-title">
	<div class="block-head">
		<h2 id="recording-title">How trades are recorded</h2>
		<p>
			Fills are the source of truth. Positions, averages and P&L are derived from them, never typed
			in.
		</p>
	</div>
	<dl class="spec">
		{#each recording as item (item.term)}
			<div>
				<dt>{item.term}</dt>
				<dd>{item.detail}</dd>
			</div>
		{/each}
		<div>
			<dt>OCC symbols</dt>
			<dd>
				Each option leg is identified by its OCC symbol: root padded to six characters, expiry as
				YYMMDD, C or P, and the strike times 1,000 in eight digits. The SPY December 18, 2026 680
				call is <code>{occExample}</code>.
			</dd>
		</div>
	</dl>
</section>

<section class="container block" data-reveal aria-labelledby="analysis-title">
	<div class="block-head">
		<h2 id="analysis-title">Payoff, Greeks and attribution</h2>
		<p>Numbers you would otherwise work out on paper, computed for every options trade.</p>
	</div>
	<div class="analysis">
		<dl class="spec">
			{#each analysis as item (item.term)}
				<div>
					<dt>{item.term}</dt>
					<dd>{item.detail}</dd>
				</div>
			{/each}
		</dl>
		<div class="figure-panel">
			<p class="figure-title">
				SPY 630/640/705/715 iron condor, {formatPrice(IRON_CONDOR_CREDIT)} credit
			</p>
			<PayoffDiagram
				legs={IRON_CONDOR.legs}
				range={IRON_CONDOR.range}
				spot={IRON_CONDOR.spot}
				rate={IRON_CONDOR.rate}
				title="Iron condor payoff at expiry and today"
				description={condorDescription}
			/>
		</div>
	</div>
</section>

<section class="container block" data-reveal aria-labelledby="reports-title">
	<div class="block-head">
		<h2 id="reports-title">Options-specific reports</h2>
		<p>
			Alongside the standard statistics, these breakdowns answer questions only options traders ask.
		</p>
	</div>
	<dl class="spec">
		{#each reports as item (item.term)}
			<div>
				<dt>{item.term}</dt>
				<dd>{item.detail}</dd>
			</div>
		{/each}
	</dl>
	<p class="more">
		<a href={resolve('/(marketing)/blog/[slug]', { slug: 'reading-pnl-attribution' })}
			>Read: reading your P&L attribution in a closed trade</a
		>
	</p>
</section>

<style>
	.head-cta {
		margin-top: var(--space-8);
	}

	.block {
		display: grid;
		gap: var(--space-8);
		padding-top: var(--space-16);
	}

	.block-head {
		display: grid;
		gap: var(--space-3);
		max-width: 60ch;
	}

	.block-head h2 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.block-head p {
		color: var(--color-ink-2);
	}

	.families {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
		border-top: 1px solid var(--color-ink);
	}

	.family {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		padding: var(--space-5) var(--space-5) var(--space-6) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.family h3 {
		font-size: var(--text-lg);
	}

	.family ul {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-2);
		color: var(--color-ink-2);
	}

	.after {
		margin-top: calc(-1 * var(--space-4));
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.92em;
		white-space: pre;
		padding: 1px var(--space-1);
		background: var(--color-surface-2);
		border-radius: var(--radius-xs);
		color: var(--color-ink);
	}

	.analysis {
		display: grid;
		gap: var(--space-10);
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
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.more {
		font-weight: 500;
	}

	@media (min-width: 1040px) {
		.analysis {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			align-items: start;
		}

		.analysis .figure-panel {
			position: sticky;
			top: 84px;
		}
	}
</style>
