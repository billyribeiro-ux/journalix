<script lang="ts">
	import {
		formatMoney,
		formatPercent,
		formatR,
		formatRatio,
		type GroupStats
	} from '@journalix/core';

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
				<tr class="row-hover">
					<th scope="row">{row.label}</th>
					<td class="r num">{row.trades}</td>
					<td class="r num">{formatPercent(row.winRate)}</td>
					<td class={['r', 'num', { gain: row.netPnl > 0, loss: row.netPnl < 0 }]}
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
	/* Scrolls sideways in a narrow panel; the shadows on either edge say there is more to see. */
	.wrap {
		overflow-x: auto;
		background:
			linear-gradient(to right, var(--color-surface) 30%, transparent) left center / 24px 100%
				no-repeat local,
			linear-gradient(to left, var(--color-surface) 30%, transparent) right center / 24px 100%
				no-repeat local,
			radial-gradient(farthest-side at 0 50%, rgb(0 0 0 / 0.16), transparent) left center / 10px
				100% no-repeat scroll,
			radial-gradient(farthest-side at 100% 50%, rgb(0 0 0 / 0.16), transparent) right center / 10px
				100% no-repeat scroll;
	}

	table {
		width: 100%;
		font-size: var(--text-sm);
	}

	/* Tight horizontal padding and wrapping headers: seven columns fit a half-width panel. */
	th,
	td {
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--color-line);
		white-space: nowrap;
	}

	thead th {
		font-weight: 500;
		color: var(--color-ink-3);
		text-align: left;
		white-space: normal;
		vertical-align: bottom;
		line-height: var(--leading-snug);
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
		color: var(--color-gain-text);
	}

	.loss {
		color: var(--color-loss-text);
	}

	.none {
		color: var(--color-ink-3);
		text-align: center;
		padding: var(--space-6);
	}
</style>
