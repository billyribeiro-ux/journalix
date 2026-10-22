<script lang="ts">
	import type { TableRow } from './chart-utils.ts';

	interface Props {
		caption: string;
		columns: readonly string[];
		rows: readonly TableRow[];
	}

	let { caption, columns, rows }: Props = $props();

	const uid = $props.id();
</script>

<!--
	The accessible twin of the chart: every value the marks show, in a real table. It is a native
	disclosure (keyboard and screen-reader operable with no script), closed by default so the chart
	stays the hero but the control is always visible and one Tab away.
-->
<details class="table-view">
	<summary>
		<span class="caret" aria-hidden="true"></span>
		View data as a table
		<span class="count">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</span>
	</summary>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable region must be keyboard focusable, WCAG 2.1.1) -->
	<div class="scroller" role="region" aria-labelledby="{uid}-cap" tabindex="0">
		<table>
			<caption id="{uid}-cap" class="visually-hidden">{caption}</caption>
			<thead>
				<tr>
					{#each columns as column, i (column)}
						<th scope="col" class={i > 0 ? 'num' : undefined}>{column}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					<tr>
						{#each row.cells as cell, i (i)}
							{#if i === 0}
								<th scope="row">{cell}</th>
							{:else}
								<td class="num">{cell}</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>

<style>
	.table-view {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
	}

	summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 24px;
		padding: 0 var(--space-2) 0 var(--space-1);
		margin-left: calc(var(--space-1) * -1);
		border-radius: var(--radius-sm);
		color: var(--color-ink-2);
		font-weight: 500;
		cursor: pointer;
		list-style: none;
		user-select: none;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	@media (hover: hover) and (pointer: fine) {
		summary:hover {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	summary:focus-visible,
	summary:active {
		transition-delay: 0s;
	}

	@media (pointer: coarse) {
		summary {
			min-height: var(--control-touch);
		}
	}

	.caret {
		width: 6px;
		height: 6px;
		border-right: 1.5px solid currentColor;
		border-bottom: 1.5px solid currentColor;
		transform: translateY(-1px) rotate(-45deg);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	details[open] .caret {
		transform: translateY(-2px) rotate(45deg);
	}

	.count {
		color: var(--color-ink-3);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
	}

	.scroller {
		max-height: 18rem;
		margin-top: var(--space-1);
		overflow: auto;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.scroller:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: -2px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	th,
	td {
		padding: var(--space-1) var(--space-3);
		text-align: left;
		white-space: nowrap;
		border-bottom: 1px solid var(--color-line);
	}

	thead th {
		position: sticky;
		top: 0;
		background: var(--color-surface-2);
		color: var(--color-ink-2);
		font-weight: 600;
	}

	tbody th {
		color: var(--color-ink);
		font-weight: 500;
	}

	td {
		color: var(--color-ink);
	}

	.num {
		text-align: right;
	}

	tbody tr:last-child > * {
		border-bottom: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.caret,
		summary {
			transition: none;
		}
	}
</style>
