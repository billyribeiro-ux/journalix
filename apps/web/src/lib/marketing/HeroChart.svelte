<script lang="ts">
	import { onMount } from 'svelte';
	import { TradeChart } from '@journalix/ui';
	import {
		STRATEGIES,
		describeContract,
		formatDateTime,
		formatMoney,
		formatPrice,
		formatQuantity,
		formatR,
		type Execution
	} from '@journalix/core';
	import { TIMEFRAME_LABELS } from '@journalix/core/market-data';
	import type { DemoTrade } from '#lib/marketing/demo-trade.ts';

	interface Props {
		demo: DemoTrade;
	}

	let { demo }: Props = $props();

	const CHART_HEIGHT = 380;

	// The chart draws on a canvas, so it mounts in the browser only; the server renders a
	// placeholder of identical size so nothing shifts when it appears.
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const view = $derived(demo.view);
	const metrics = $derived(view.metrics);
	const leg = $derived(view.trade.legs[0]);
	const contract = $derived(
		leg && (leg.kind === 'call' || leg.kind === 'put') && leg.strike !== null && leg.expiration
			? describeContract({
					underlying: leg.underlying,
					expiration: leg.expiration,
					kind: leg.kind,
					strike: leg.strike
				})
			: view.trade.underlying
	);

	interface LedgerRow {
		readonly id: string;
		readonly action: string;
		readonly execution: Execution;
	}

	/** Labels each fill by what it did to the position: entry, add, partial exit or exit. */
	const ledger = $derived.by((): LedgerRow[] => {
		const sorted = view.trade.executions.toSorted(
			(a, b) => Date.parse(a.executedAt) - Date.parse(b.executedAt)
		);
		const openSide = sorted[0]?.side;
		let position = 0;
		let opened = false;
		return sorted.map((execution) => {
			const opening = execution.side === openSide;
			let action: string;
			if (opening) {
				action = opened ? 'Add' : 'Entry';
				opened = true;
				position += execution.quantity;
			} else {
				position -= execution.quantity;
				action = position > 0 ? 'Partial exit' : 'Exit';
			}
			return { id: execution.id, action, execution };
		});
	});

	const unit = $derived(leg?.kind === 'stock' ? 'Shares' : 'Contracts');
	const pnlClass = $derived(metrics.netPnl >= 0 ? 'gain' : 'loss');
</script>

<figure class="hero-chart" aria-labelledby="hero-chart-caption">
	<div class="chart-head">
		<p class="instrument">
			<span class="symbol">{contract}</span>
			<span class="muted">{STRATEGIES[metrics.strategy].label}</span>
		</p>
		<p class="result">
			<span class="muted">Net</span>
			<span class="num {pnlClass}">{formatMoney(metrics.netPnl, { signed: true })}</span>
			{#if metrics.rMultiple !== null}
				<span class="num {pnlClass}">{formatR(metrics.rMultiple)}</span>
			{/if}
		</p>
	</div>

	<div class="chart" style:height="{CHART_HEIGHT}px">
		{#if mounted}
			<TradeChart
				{view}
				bars={demo.bars}
				timeframe={demo.timeframe}
				timeZone={demo.timeZone}
				simulated
				height={CHART_HEIGHT}
				mode="underlying"
			/>
		{/if}
	</div>

	<div class="ledger">
		<table>
			<caption class="visually-hidden">Fills for this trade</caption>
			<thead>
				<tr>
					<th scope="col">Fill</th>
					<th scope="col">Time (ET)</th>
					<th scope="col" class="r">{unit}</th>
					<th scope="col" class="r">Price</th>
					<th scope="col" class="r">{view.trade.underlying}</th>
				</tr>
			</thead>
			<tbody>
				{#each ledger as row (row.id)}
					<tr>
						<th scope="row">
							<span class="side" data-side={row.execution.side}>{row.action}</span>
						</th>
						<td>{formatDateTime(row.execution.executedAt, demo.timeZone, 'datetime')}</td>
						<td class="r">
							{row.execution.side === 'buy' ? '+' : '−'}{formatQuantity(row.execution.quantity)}
						</td>
						<td class="r">{formatPrice(row.execution.price)}</td>
						<td class="r">{formatPrice(row.execution.underlyingPrice)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<figcaption id="hero-chart-caption">
		A sample {STRATEGIES[metrics.strategy].label.toLowerCase()} with an add and a partial exit, on
		{TIMEFRAME_LABELS[demo.timeframe].toLowerCase()} candles of the underlying. Simulated prices for illustration.
	</figcaption>
</figure>

<style>
	.hero-chart {
		display: grid;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		min-width: 0;
	}

	.chart-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2) var(--space-6);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-line);
		font-size: var(--text-sm);
	}

	.instrument,
	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
	}

	.symbol {
		font-weight: 600;
		color: var(--color-ink);
	}

	.result .num {
		font-weight: 600;
	}

	.chart {
		min-width: 0;
		background:
			linear-gradient(var(--chart-grid) 1px, transparent 1px) 0 0 / 100% 64px,
			var(--color-surface);
	}

	.chart:has(> :global(*)) {
		background: var(--color-surface);
	}

	.ledger {
		position: relative;
		overflow-x: auto;
		border-top: 1px solid var(--color-line);
	}

	table {
		width: 100%;
		min-width: 520px;
		font-size: var(--text-sm);
	}

	th,
	td {
		padding: var(--space-2) var(--space-4);
		text-align: left;
		white-space: nowrap;
		border-bottom: 1px solid var(--color-line);
	}

	thead th {
		color: var(--color-ink-3);
		font-weight: 500;
		font-size: var(--text-xs);
	}

	tbody tr:last-child > * {
		border-bottom: 0;
	}

	tbody th {
		font-weight: 500;
	}

	td {
		color: var(--color-ink-2);
	}

	.r {
		text-align: right;
	}

	.side {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-ink);
	}

	.side::before {
		content: '';
		width: 0;
		height: 0;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
	}

	.side[data-side='buy']::before {
		border-bottom: 7px solid var(--color-ink);
	}

	.side[data-side='sell']::before {
		border-top: 7px solid var(--color-ink-3);
	}

	figcaption {
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-line);
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}
</style>
