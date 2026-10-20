<script lang="ts">
	import {
		formatMoney,
		formatPercent,
		formatR,
		formatRatio,
		type GroupStats
	} from '@strikebook/core';

	interface Props {
		rows: readonly GroupStats[];
		currency: string;
		label: string;
		/** Column heading for the group name. */
		heading: string;
	}

	let { rows, currency, label, heading }: Props = $props();
	const money = (v: number, signed = true): string => formatMoney(v, { currency, signed });
</script>

<div class="wrap">
	<table aria-label={label}>
		<thead>
			<tr>
				<th scope="col">{heading}</th>
				<th scope="col" class="r">Trades</th>
				<th scope="col" class="r">Win rate</th>
				<th scope="col" class="r">Net P&amp;L</th>
				<th scope="col" class="r">Avg P&amp;L</th>
				<th scope="col" class="r">Profit factor</th>
				<th scope="col" class="r">Avg R</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr>
					<th scope="row">{row.label}</th>
					<td class="r num">{row.trades}</td>
					<td class="r num">{formatPercent(row.winRate)}</td>
					<td class="r num" class:gain={row.netPnl > 0} class:loss={row.netPnl < 0}
						>{money(row.netPnl)}</td
					>
					<td class="r num">{money(row.averagePnl)}</td>
					<td class="r num">{formatRatio(row.profitFactor, 2, row.grossProfit > 0)}</td>
					<td class="r num">{formatR(row.averageR)}</td>
				</tr>
			{:else}
				<tr><td colspan="7" class="none">No closed trades in this group.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		font-size: var(--text-sm);
	}

	th,
	td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		white-space: nowrap;
	}

	thead th {
		font-weight: 500;
		color: var(--color-ink-3);
		text-align: left;
	}

	tbody th {
		font-weight: 500;
		text-align: left;
	}

	th:first-child,
	td:first-child {
		padding-left: 0;
	}

	.r {
		text-align: right;
	}

	thead .r {
		text-align: right;
	}

	.gain {
		color: var(--color-gain);
	}

	.loss {
		color: var(--color-loss);
	}

	.none {
		color: var(--color-ink-3);
		text-align: center;
		padding: var(--space-6);
	}
</style>
