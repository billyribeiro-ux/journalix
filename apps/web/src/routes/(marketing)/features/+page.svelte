<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@journalix/ui';
	import Seo from '#lib/marketing/Seo.svelte';

	interface Group {
		readonly id: string;
		readonly title: string;
		readonly summary: string;
		readonly items: readonly { readonly term: string; readonly detail: string }[];
	}

	const groups: readonly Group[] = [
		{
			id: 'journal',
			title: 'Journal',
			summary: 'A trade is a set of legs and the executions on them, recorded as they happened.',
			items: [
				{
					term: 'Execution-level entry',
					detail:
						'Log entries, adds, partial exits and full exits as separate fills, each with its own time, price, quantity and fees.'
				},
				{
					term: 'Underlying price at each fill',
					detail:
						'Record where the stock or index traded when an option filled. It positions option fills on the underlying chart and drives the IV and Greeks calculations.'
				},
				{
					term: 'Stocks, options and futures',
					detail:
						'Shares, calls, puts and futures contracts, with multipliers per leg. Crypto and forex legs are supported for traders who journal them alongside.'
				},
				{
					term: 'Stops and targets with history',
					detail:
						'Set a stop and target at entry and move them as the trade develops. Every change is kept with its time and an optional note.'
				},
				{
					term: 'Thesis and review',
					detail:
						'Write why you took the trade before it plays out and what you learned after. Add a 1–5 rating and a confidence score.'
				},
				{
					term: 'Average-cost accounting',
					detail:
						'Realized P&L, average entry and exit, fees and peak size are computed per leg by replaying fills in order.'
				}
			]
		},
		{
			id: 'chart',
			title: 'Chart review',
			summary:
				'Every closed or open trade opens on a candlestick chart with the fills drawn on it.',
			items: [
				{
					term: 'Fill markers',
					detail:
						'Entries, adds and exits are marked at their exact time and price, distinguishing long from short.'
				},
				{
					term: 'Stop and target lines',
					detail:
						'Levels are drawn as lines that step to their new price each time you moved them, so you can see whether a stop was tightened or widened.'
				},
				{
					term: 'Risk and reward zones',
					detail:
						'The distance from entry to the initial stop and target is shaded, with the planned reward-to-risk ratio.'
				},
				{
					term: 'Running P&L',
					detail:
						'Follow the open P&L of the position across the chart, including the effect of adds and partial exits.'
				},
				{
					term: 'Underlying or contract view',
					detail:
						'Plot option fills against the underlying price, or the option premium itself when your data provider supports option bars.'
				},
				{
					term: 'Automatic timeframe',
					detail:
						'A bar size is chosen from the holding time (from 1-minute for scalps to weekly for long holds) and the window is padded on both sides.'
				}
			]
		},
		{
			id: 'options',
			title: 'Options',
			summary: 'Multi-leg structures are first-class: one trade, many legs, one set of numbers.',
			items: [
				{
					term: 'Strategy detection',
					detail:
						'More than 30 structures are recognised from the legs: singles, verticals, straddles, strangles, iron condors and butterflies, calendars, diagonals, covered calls, protective puts and collars.'
				},
				{
					term: 'OCC symbols',
					detail:
						'Every option leg carries its standard 21-character OCC symbol (root, expiry, call or put, strike), the same identifier brokers and data vendors use.'
				},
				{
					term: 'Assignment, exercise and expiration',
					detail:
						'Close a leg by expiring it worthless or recording assignment or exercise, rather than inventing a closing fill.'
				},
				{
					term: 'Max profit, max loss and breakevens',
					detail:
						'Computed exactly from the strikes and premiums of the opening structure, including unlimited-risk cases.'
				},
				{
					term: 'Payoff diagrams',
					detail:
						'The P&L curve at expiry and today, valued with Black-Scholes using the implied volatility from your fills.'
				},
				{
					term: 'Implied volatility and Greeks',
					detail:
						'IV is solved from each fill price, then delta, gamma, theta and vega are reported per leg and for the position at entry.'
				},
				{
					term: 'P&L attribution',
					detail:
						'An estimate of how much of a closed trade’s result came from delta, gamma, theta and vega, with the residual shown.'
				}
			]
		},
		{
			id: 'analytics',
			title: 'Analytics',
			summary:
				'Reports are computed from the same fills as the trade pages, so every number agrees.',
			items: [
				{
					term: 'Equity and drawdown',
					detail:
						'An equity curve per account or across accounts, with maximum drawdown in dollars and percent, the longest stretch under water, current drawdown and recovery factor.'
				},
				{
					term: 'P&L calendar',
					detail: 'Daily net P&L by month, with trade counts and green-day rate.'
				},
				{
					term: 'Core statistics',
					detail:
						'Win rate, profit factor, expectancy, average win and loss, payoff ratio, largest win and loss, and consecutive win and loss streaks.'
				},
				{
					term: 'R-multiples',
					detail:
						'Per-trade R from planned risk, the initial stop or the structure’s max loss, with an R distribution, average R, total R and SQN.'
				},
				{
					term: 'Risk-adjusted returns',
					detail: 'Sharpe, Sortino and Calmar ratios from daily returns, plus daily volatility.'
				},
				{
					term: 'Breakdowns',
					detail:
						'Group results by strategy, symbol, DTE at entry, weekday, hour, month, holding time, long vs short, credit vs debit, playbook, tag and expiry outcome.'
				}
			]
		},
		{
			id: 'playbooks',
			title: 'Playbooks and tags',
			summary: 'Name your setups, write their rules, and see which ones make money.',
			items: [
				{
					term: 'Playbooks',
					detail:
						'Define a setup with a description and a checklist of rules, assign trades to it and compare playbooks side by side.'
				},
				{
					term: 'Tags in four categories',
					detail:
						'Setup, mistake, emotion and market tags, plus custom ones, each with a colour. Filter and break down results by any tag.'
				},
				{
					term: 'Cost of mistakes',
					detail:
						'Group by mistake tags to see what a moved stop or a FOMO entry has cost you in dollars and R.'
				}
			]
		},
		{
			id: 'notebook',
			title: 'Notebook',
			summary: 'Notes that belong to a trading day rather than to a single trade.',
			items: [
				{
					term: 'Pre-market plans',
					detail:
						'Write the plan before the open: levels, events and the setups you are waiting for.'
				},
				{
					term: 'Recaps and lessons',
					detail:
						'Close the day with a recap and keep lessons you want to come back to, next to that day’s trades and P&L.'
				}
			]
		},
		{
			id: 'accounts',
			title: 'Accounts and filters',
			summary: 'Keep separate accounts apart, or look at all of them together.',
			items: [
				{
					term: 'Multiple accounts',
					detail:
						'Track each brokerage or strategy account with its own currency and starting balance, and archive accounts you no longer use.'
				},
				{
					term: 'Global filters',
					detail:
						'Filter by account, date range, symbol, strategy, playbook, tag, direction and outcome once, and every report follows.'
				},
				{
					term: 'Export',
					detail: 'Download your whole journal as a single JSON file you can keep or re-import.'
				}
			]
		},
		{
			id: 'data',
			title: 'Data and privacy',
			summary: 'Market data comes from your own provider account. Your journal stays yours.',
			items: [
				{
					term: 'Your own provider key',
					detail:
						'Connect Massive (formerly Polygon), Alpaca, Databento or Tiingo in Settings. Keys are encrypted at rest with AES-256-GCM and never shown back in full.'
				},
				{
					term: 'Built-in simulator',
					detail:
						'Simulated candles that pass through your fills, for demos and for trying the app before you connect a provider. Charts using it are labelled.'
				},
				{
					term: 'Bar cache',
					detail:
						'Fetched candles are cached so reopening a trade doesn’t spend your provider’s rate limit again.'
				},
				{
					term: 'No resale, no ad tracking',
					detail:
						'Journal data is not sold, shared with advertisers or used to train models. Cookies are used only to keep you signed in.'
				}
			]
		},
		{
			id: 'desktop',
			title: 'Desktop app',
			summary: 'The same journal as a native application.',
			items: [
				{
					term: 'macOS, Windows and Linux',
					detail:
						'A native app built with Tauri, with the same screens and analytics as the web app.'
				},
				{
					term: 'Local database',
					detail:
						'The whole journal lives in a SQLite database on your machine. Back it up like any other file.'
				}
			]
		}
	];

	const roadmap = [
		'Broker import is on the roadmap. Today, trades are entered by hand.',
		'There are no AI features. Every number comes from your fills and a formula you can check.'
	] as const;
</script>

<Seo
	title="Features"
	description="Every Journalix feature: execution-level journaling, chart review with fills and stop history, multi-leg options analysis, Greeks and IV, analytics, playbooks, notebook and desktop app."
	path="/features"
/>

<header class="page-head container">
	<h1>Feature reference</h1>
	<p class="lede">
		Everything Journalix does today, grouped by what you use it for. If something isn’t on this
		page, it isn’t in the product yet.
	</p>
	<nav class="toc" aria-label="Feature groups">
		<ul role="list">
			{#each groups as group (group.id)}
				<li><a href="#{group.id}">{group.title}</a></li>
			{/each}
		</ul>
	</nav>
</header>

<div class="container groups">
	{#each groups as group (group.id)}
		<section id={group.id} class="group" aria-labelledby="{group.id}-title">
			<div class="group-head">
				<h2 id="{group.id}-title">{group.title}</h2>
				<p>{group.summary}</p>
			</div>
			<dl class="spec">
				{#each group.items as item (item.term)}
					<div>
						<dt>{item.term}</dt>
						<dd>{item.detail}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}

	<section class="group" aria-labelledby="not-yet-title">
		<div class="group-head">
			<h2 id="not-yet-title">Not in Journalix yet</h2>
			<p>So you know what to expect.</p>
		</div>
		<ul class="not-yet" role="list">
			{#each roadmap as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	</section>

	<div class="end cta-row">
		<Button href={resolve('signup')} variant="primary">Start journaling</Button>
		<Button href={resolve('pricing')} variant="secondary">Compare plans</Button>
	</div>
</div>

<style>
	.toc {
		margin-top: var(--space-8);
	}

	/* Chips rather than bare links: 32px tall on a pointer, 44px on touch, so each is an easy target. */
	.toc ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.toc a {
		display: inline-flex;
		align-items: center;
		min-height: var(--control-dense);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		font-weight: 500;
		text-decoration: none;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.toc a:hover {
			border-color: var(--color-control-line);
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.toc a:focus-visible,
	.toc a:active {
		transition-delay: 0s;
	}

	@media (pointer: coarse) {
		.toc a {
			min-height: var(--control-touch);
		}
	}

	.groups {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.group {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-6);
		padding-top: var(--space-16);
	}

	.group-head {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.group-head h2 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.group-head p {
		max-width: 44ch;
		color: var(--color-ink-2);
	}

	.not-yet {
		display: grid;
		border-top: 1px solid var(--color-line);
	}

	.not-yet li {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--color-line);
		color: var(--color-ink-2);
		max-width: var(--prose-max);
	}

	.end {
		margin-top: var(--space-16);
	}

	@media (min-width: 1040px) {
		.group {
			grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
			gap: var(--space-12);
		}

		/* The group title stays beside its rows while a long group scrolls. */
		.group-head {
			position: sticky;
			top: 84px;
			align-self: start;
		}
	}
</style>
