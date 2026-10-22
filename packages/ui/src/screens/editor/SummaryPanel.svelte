<script lang="ts">
	import {
		formatDuration,
		formatMoney,
		formatPrice,
		formatR,
		STRATEGIES,
		type TradeMetrics
	} from '@journalix/core';
	import StatusBadge from '../parts/StatusBadge.svelte';

	interface Props {
		metrics: TradeMetrics | null;
		currency: string;
	}

	let { metrics, currency }: Props = $props();
	const money = (v: number | null, signed = false): string => formatMoney(v, { currency, signed });
</script>

<aside class="summary" aria-label="Live trade summary">
	<h2>Summary</h2>
	{#if !metrics}
		<p class="muted">
			Add a symbol, legs and at least one complete fill to see the trade computed live.
		</p>
	{:else}
		<div class="head">
			<StatusBadge status={metrics.status} outcome={metrics.outcome} />
			<span class="strategy">{STRATEGIES[metrics.strategy].label}</span>
		</div>
		<p class={['pnl', 'num', { gain: metrics.netPnl > 0, loss: metrics.netPnl < 0 }]}>
			{metrics.status === 'closed' ? money(metrics.netPnl, true) : money(metrics.grossPnl, true)}
		</p>
		<p class="pnl-label">
			{metrics.status === 'closed' ? 'Net P&L after fees' : 'Realized so far (before fees)'}
		</p>
		<dl>
			<div>
				<dt>Direction</dt>
				<dd>
					{metrics.direction === 'long' ? 'Long' : 'Short'}{metrics.entryType !== 'even'
						? `, ${metrics.entryType}`
						: ''}
				</dd>
			</div>
			{#if metrics.entryType !== 'even'}
				<div>
					<dt>{metrics.entryType === 'credit' ? 'Credit received' : 'Debit paid'}</dt>
					<dd class="num">{money(Math.abs(metrics.openingCashflow))}</dd>
				</div>
			{/if}
			<div>
				<dt>Fees</dt>
				<dd class="num">{money(metrics.fees)}</dd>
			</div>
			{#if metrics.initialRisk !== null}
				<div>
					<dt>Risk ({metrics.riskSource})</dt>
					<dd class="num">{money(metrics.initialRisk)}</dd>
				</div>
			{/if}
			{#if metrics.rMultiple !== null}
				<div>
					<dt>R-multiple</dt>
					<dd class="num">{formatR(metrics.rMultiple)}</dd>
				</div>
			{/if}
			{#if metrics.maxProfit !== null || metrics.maxLoss !== null || metrics.definedRisk}
				<div>
					<dt>Max profit</dt>
					<dd class="num">{metrics.maxProfit === null ? 'Unlimited' : money(metrics.maxProfit)}</dd>
				</div>
				<div>
					<dt>Max loss</dt>
					<dd class="num">{metrics.maxLoss === null ? 'Unlimited' : money(metrics.maxLoss)}</dd>
				</div>
			{/if}
			{#if metrics.breakevens.length}
				<div>
					<dt>Breakeven</dt>
					<dd class="num">{metrics.breakevens.map((b) => formatPrice(b)).join(', ')}</dd>
				</div>
			{/if}
			{#if metrics.dteAtEntry !== null}
				<div>
					<dt>DTE at entry</dt>
					<dd class="num">{metrics.dteAtEntry}</dd>
				</div>
			{/if}
			{#if metrics.holdMs !== null}
				<div>
					<dt>Held</dt>
					<dd class="num">{formatDuration(metrics.holdMs)}</dd>
				</div>
			{/if}
			<div>
				<dt>Adds and partials</dt>
				<dd class="num">{metrics.adds} / {metrics.partialExits}</dd>
			</div>
		</dl>
	{/if}
</aside>

<style>
	.summary {
		padding: var(--space-5);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
	}

	h2 {
		font-size: var(--text-md);
		margin-bottom: var(--space-3);
	}

	.muted {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.strategy {
		font-weight: 500;
	}

	.pnl {
		margin-top: var(--space-4);
		font-size: var(--text-3xl);
		font-weight: 600;
		letter-spacing: var(--tracking-display);
		font-variant-numeric: normal;
	}

	.gain {
		color: var(--color-gain-text);
	}

	.loss {
		color: var(--color-loss-text);
	}

	.pnl-label {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
		margin-bottom: var(--space-4);
	}

	dl {
		display: grid;
		margin: 0;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--color-line);
		font-size: var(--text-sm);
	}

	dt {
		color: var(--color-ink-3);
	}

	dd {
		margin: 0;
		text-align: right;
		font-weight: 500;
	}
</style>
