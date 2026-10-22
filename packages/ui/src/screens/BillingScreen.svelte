<script lang="ts">
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import { useApp } from '../app/context.ts';
	import { PLANS, planPrice, type BillingInterval } from '../app/plans.ts';
	import Button from '../primitives/Button.svelte';
	import Badge from '../primitives/Badge.svelte';
	import Panel from '../primitives/Panel.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import PageHeader from './parts/PageHeader.svelte';

	const { journal, env } = useApp();
	let interval = $state<BillingInterval>('yearly');

	const usage = $derived([
		{ label: 'Trading accounts', value: journal.accounts.filter((a) => !a.archived).length },
		{ label: 'Trades', value: journal.trades.length },
		{ label: 'Market data providers', value: journal.providers.length },
		{ label: 'Notes', value: journal.notes.length }
	]);

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});
</script>

<PageHeader title="Billing" description="Your plan and usage." />

<div class="notice" role="note">
	<InfoIcon size={20} weight="fill" aria-hidden="true" />
	<div>
		<p class="notice-title">Early access: every feature is included at no cost</p>
		<p>
			Paid plans are not on sale yet, so there is nothing to pay and no card on file. When billing
			opens you will be able to choose a plan here before anything changes.
		</p>
	</div>
</div>

<div class="grid">
	<Panel title="Current plan">
		<div class="current">
			<p class="plan-name">Early access</p>
			<Badge tone="signal">All features</Badge>
		</div>
		<p class="muted">
			{env.platform === 'desktop'
				? 'Desktop app, data stored on this computer.'
				: `Account ${env.user?.email ?? ''}`}
		</p>
	</Panel>

	<Panel title="Usage">
		<dl class="usage">
			{#each usage as item (item.label)}
				<div>
					<dt>{item.label}</dt>
					<dd class="num">{item.value.toLocaleString('en-US')}</dd>
				</div>
			{/each}
		</dl>
	</Panel>
</div>

<section class="plans-section" aria-labelledby="plans-title">
	<div class="plans-bar">
		<div>
			<h2 id="plans-title">Plans after early access</h2>
			<p class="plans-note">
				Planned plans and prices, shown for reference. They may change before billing opens, and
				nothing on this page can charge you.
			</p>
		</div>
		<Segmented
			label="Billing interval"
			bind:value={interval}
			options={[
				{ value: 'monthly', label: 'Monthly' },
				{ value: 'yearly', label: 'Yearly' }
			]}
		/>
	</div>
	<ul class="plans" role="list">
		{#each PLANS as plan (plan.id)}
			{const price = $derived(planPrice(plan, interval))}
			<li class={['plan', plan.featured && 'featured']}>
				<div class="plan-head">
					<h3>{plan.name}</h3>
					<Badge tone="outline">Not on sale yet</Badge>
				</div>
				<p class="summary">{plan.summary}</p>
				<p class="price">
					<span class="amount num">{price === 0 ? 'Free' : usd.format(price)}</span>
					{#if price > 0}<span class="per"
							>per month{interval === 'yearly' ? ', billed yearly' : ''}</span
						>{/if}
				</p>
				<ul class="includes" role="list">
					{#each plan.includes as line (line)}
						<li><CheckIcon size={14} weight="bold" aria-hidden="true" />{line}</li>
					{/each}
				</ul>
				<Button disabled variant={plan.featured ? 'primary' : 'secondary'}
					>Available when billing opens</Button
				>
			</li>
		{/each}
	</ul>
</section>

<style>
	.notice {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		margin-bottom: var(--space-5);
		background: var(--color-signal-soft);
		border-left: 3px solid var(--color-signal);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		color: var(--color-ink);
	}

	.notice :global(svg) {
		flex-shrink: 0;
		color: var(--color-signal-ink);
	}

	.notice p {
		font-size: var(--text-sm);
		max-width: var(--prose-max);
	}

	.notice .notice-title {
		font-weight: 600;
		font-size: var(--text-base);
		margin-bottom: var(--space-1);
	}

	.grid {
		display: grid;
		gap: var(--space-5);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
	}

	.current {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.plan-name {
		font-size: var(--text-xl);
		font-weight: 600;
	}

	.usage {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3) var(--space-5);
	}

	dt {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	dd {
		margin: 0;
		font-size: var(--text-lg);
	}

	.plans-section {
		margin-top: var(--space-8);
	}

	.plans-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	h2 {
		font-size: var(--text-lg);
	}

	.plans-note {
		margin-top: var(--space-1);
		max-width: var(--prose-max);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.plan-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.plans {
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
	}

	.plan {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
	}

	.plan.featured {
		border-color: var(--color-signal);
	}

	h3 {
		font-size: var(--text-md);
	}

	.summary {
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.price {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.amount {
		font-size: var(--text-2xl);
		font-weight: 600;
	}

	.per {
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.includes {
		margin: 0 0 var(--space-2);
		padding: 0;
		display: grid;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}

	.includes li {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
	}

	.includes :global(svg) {
		flex-shrink: 0;
		color: var(--color-gain);
	}

	.plan :global(.btn) {
		margin-top: auto;
	}
</style>
