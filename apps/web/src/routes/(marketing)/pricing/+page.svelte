<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Button,
		PLANS,
		planPrice,
		Segmented,
		type BillingInterval,
		type Plan
	} from '@strikebook/ui';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
	import Seo from '#lib/marketing/Seo.svelte';

	type Billing = BillingInterval;
	const plans = PLANS;

	const billingOptions = [
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'yearly', label: 'Yearly' }
	] as const;

	let billing = $state<Billing>('yearly');

	type Cell = boolean | string;
	const comparison: readonly {
		readonly group: string;
		readonly rows: readonly {
			readonly feature: string;
			readonly values: readonly [Cell, Cell, Cell];
		}[];
	}[] = [
		{
			group: 'Journal',
			rows: [
				{ feature: 'Trading accounts', values: ['1', 'Unlimited', 'Unlimited'] },
				{ feature: 'Execution-level trade entry', values: [true, true, true] },
				{ feature: 'Stop and target history', values: [true, true, true] },
				{ feature: 'Playbooks and tags', values: [true, true, true] },
				{ feature: 'Daily notebook', values: [true, true, true] }
			]
		},
		{
			group: 'Charts and data',
			rows: [
				{ feature: 'Trade chart with fills', values: [true, true, true] },
				{ feature: 'Simulated candles', values: [true, true, true] },
				{
					feature: 'Your own data provider (Massive, Alpaca, Databento, Tiingo)',
					values: [false, true, true]
				}
			]
		},
		{
			group: 'Options',
			rows: [
				{ feature: 'Multi-leg structures and strategy detection', values: [true, true, true] },
				{ feature: 'Max profit, max loss and breakevens', values: [true, true, true] },
				{ feature: 'Payoff diagrams', values: [false, true, true] },
				{ feature: 'Implied volatility and Greeks', values: [false, true, true] },
				{ feature: 'P&L attribution', values: [false, true, true] }
			]
		},
		{
			group: 'Analytics',
			rows: [
				{
					feature: 'Equity curve, P&L calendar and core statistics',
					values: [true, true, true]
				},
				{ feature: 'R-multiples, SQN, Sharpe and Sortino', values: [true, true, true] },
				{
					feature: 'All breakdowns (DTE, expiry outcome, hour, tag and more)',
					values: [false, true, true]
				},
				{ feature: 'Journal export', values: [false, true, true] }
			]
		},
		{
			group: 'Desktop and support',
			rows: [
				{
					feature: 'Desktop app (macOS, Windows, Linux)',
					values: [false, false, 'Up to 3 machines']
				},
				{ feature: 'Support', values: ['Email', 'Email', 'Priority'] }
			]
		}
	];

	const faqs = [
		{
			q: 'Is anything charged during early access?',
			a: 'No. Billing isn’t live yet, and every feature, including those listed under Pro and Desk, is available to every account during early access. No card is collected.'
		},
		{
			q: 'What happens when billing goes live?',
			a: 'You will be told by email before any change, with enough notice to pick a plan or export your journal. Nothing is charged automatically: you choose a plan and enter payment details yourself.'
		},
		{
			q: 'Do I need a market data subscription?',
			a: 'Not to start. The simulator draws charts that pass through your fills so you can review trades straight away. For real candles you add your own key from Massive (formerly Polygon), Alpaca, Databento or Tiingo. Their pricing is separate from Strikebook’s.'
		},
		{
			q: 'Can I import trades from my broker?',
			a: 'Not yet. Trades are entered by hand, leg by leg. Broker import is on the roadmap.'
		},
		{
			q: 'How does the desktop licence work?',
			a: 'A Desk subscription lets you run the desktop app on up to three of your own machines. The desktop app stores its journal locally in a SQLite database on each machine.'
		},
		{
			q: 'Can I take my data with me?',
			a: 'Yes. You can export your whole journal as JSON at any time, delete all of your journal data from Settings, and ask us to delete your account.'
		}
	] as const;

	function price(plan: Plan): number {
		return planPrice(plan, billing);
	}
</script>

<Seo
	title="Pricing"
	description="Strikebook plans: Starter (free), Pro and Desk. Billing isn’t live yet; during early access every feature is free with no card required."
	path="/pricing"
/>

<header class="page-head container">
	<h1>Plans and pricing</h1>
	<p class="notice" role="note">
		<strong>Billing isn’t live yet.</strong> During early access every feature is free — no card required.
	</p>
</header>

<section class="container plans-section" aria-labelledby="plans-title">
	<div class="plans-bar">
		<h2 id="plans-title">Choose a plan</h2>
		<div class="billing">
			<Segmented bind:value={billing} options={billingOptions} label="Billing period" />
			<span class="note">Yearly saves up to 17%</span>
		</div>
	</div>

	<ul class="plans" role="list">
		{#each plans as plan (plan.id)}
			<li class="plan" class:featured={plan.featured}>
				<h3>{plan.name}</h3>
				<p class="summary">{plan.summary}</p>
				<p class="price">
					<span class="amount num">${price(plan)}</span>
					<span class="per">
						{#if plan.monthly === 0}
							free
						{:else}
							per month{billing === 'yearly' ? ', billed yearly' : ''}
						{/if}
					</span>
				</p>
				<div class="plan-cta">
					<Button
						href={resolve(`signup?plan=${plan.id}`)}
						variant={plan.featured ? 'primary' : 'secondary'}
					>
						{plan.monthly === 0 ? 'Start free' : `Choose ${plan.name}`}
					</Button>
				</div>
				<ul class="includes" role="list">
					{#each plan.includes as item (item)}
						<li>
							<CheckIcon size={16} aria-hidden="true" />
							<span>{item}</span>
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>
</section>

<section class="container compare" aria-labelledby="compare-title">
	<h2 id="compare-title">Compare plans</h2>
	<div class="table-wrap">
		<table>
			<caption class="visually-hidden">Features included in each plan</caption>
			<thead>
				<tr>
					<th scope="col">Feature</th>
					{#each plans as plan (plan.id)}
						<th scope="col" class="c">{plan.name}</th>
					{/each}
				</tr>
			</thead>
			{#each comparison as section (section.group)}
				<tbody>
					<tr class="group-row">
						<th scope="colgroup" colspan="4">{section.group}</th>
					</tr>
					{#each section.rows as row (row.feature)}
						<tr>
							<th scope="row">{row.feature}</th>
							{#each row.values as value, index (index)}
								<td class="c">
									{#if value === true}
										<CheckIcon size={16} aria-hidden="true" />
										<span class="visually-hidden">Included</span>
									{:else if value === false}
										<MinusIcon size={16} aria-hidden="true" class="no" />
										<span class="visually-hidden">Not included</span>
									{:else}
										{value}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>
	</div>
</section>

<section class="container faq" aria-labelledby="faq-title">
	<h2 id="faq-title">Questions</h2>
	<div class="faq-list">
		{#each faqs as item (item.q)}
			<details>
				<summary>{item.q}</summary>
				<p>{item.a}</p>
			</details>
		{/each}
	</div>
	<p class="note faq-more">
		Something else? <a href={resolve('contact')}>Contact us</a>.
	</p>
</section>

<style>
	.notice {
		max-width: var(--prose-max);
		margin-top: var(--space-6);
		padding: var(--space-4) var(--space-5);
		border-left: 3px solid var(--color-signal);
		background: var(--color-surface);
		color: var(--color-ink-2);
		font-size: var(--text-md);
	}

	.notice strong {
		color: var(--color-ink);
		font-weight: 600;
	}

	.plans-section {
		padding-top: var(--space-12);
	}

	.plans-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}

	.plans-bar h2,
	.compare h2,
	.faq h2 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.billing {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.plans {
		display: grid;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.plan {
		display: grid;
		grid-template-rows: auto auto auto auto 1fr;
		gap: var(--space-3);
		padding: var(--space-6);
		border-bottom: 1px solid var(--color-line);
	}

	.plan:last-child {
		border-bottom: 0;
	}

	.plan.featured {
		box-shadow: inset 0 3px 0 var(--color-ink);
	}

	.plan h3 {
		font-size: var(--text-xl);
	}

	.summary {
		color: var(--color-ink-2);
	}

	.price {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.amount {
		font-size: var(--text-4xl);
		font-weight: 600;
		letter-spacing: var(--tracking-display);
		line-height: 1;
	}

	.per {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.plan-cta {
		display: grid;
		margin: var(--space-2) 0 var(--space-3);
	}

	.plan-cta :global(.btn) {
		min-height: 44px;
		font-size: var(--text-md);
	}

	.includes {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
		font-size: var(--text-base);
		color: var(--color-ink-2);
	}

	.includes li {
		display: grid;
		grid-template-columns: 16px 1fr;
		gap: var(--space-2);
		align-items: start;
	}

	.includes :global(svg) {
		margin-top: 0.2em;
		color: var(--color-ink);
	}

	.compare,
	.faq {
		padding-top: var(--space-16);
	}

	.table-wrap {
		position: relative;
		margin-top: var(--space-6);
		overflow-x: auto;
		border-top: 1px solid var(--color-ink);
	}

	table {
		width: 100%;
		min-width: 560px;
		font-size: var(--text-base);
	}

	th,
	td {
		padding: var(--space-3) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		text-align: left;
		vertical-align: middle;
	}

	thead th {
		color: var(--color-ink);
		font-weight: 600;
	}

	tbody th {
		font-weight: 400;
		color: var(--color-ink-2);
	}

	.group-row th {
		padding-top: var(--space-6);
		color: var(--color-ink);
		font-weight: 600;
	}

	.c {
		width: 18%;
		text-align: center;
	}

	td.c :global(svg) {
		display: inline-block;
		vertical-align: middle;
	}

	td :global(.no) {
		color: var(--color-ink-3);
	}

	td {
		color: var(--color-ink);
		font-size: var(--text-sm);
	}

	.faq-list {
		max-width: var(--prose-max);
		margin-top: var(--space-6);
		border-top: 1px solid var(--color-line);
	}

	details {
		border-bottom: 1px solid var(--color-line);
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-4) 0;
		cursor: pointer;
		font-weight: 500;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: '+';
		flex: none;
		color: var(--color-ink-3);
		font-size: var(--text-lg);
		line-height: 1;
	}

	details[open] summary::after {
		content: '−';
	}

	details p {
		padding-bottom: var(--space-5);
		color: var(--color-ink-2);
	}

	.faq-more {
		margin-top: var(--space-6);
	}

	@media (min-width: 900px) {
		.plans {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.summary {
			min-height: 3em;
		}

		.plan {
			border-bottom: 0;
			border-right: 1px solid var(--color-line);
		}

		.plan:last-child {
			border-right: 0;
		}
	}
</style>
