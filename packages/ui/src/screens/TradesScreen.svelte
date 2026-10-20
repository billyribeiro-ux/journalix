<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import {
		formatDateTime,
		formatDuration,
		formatMoney,
		formatPrice,
		formatQuantity,
		formatR,
		STRATEGIES,
		type TradeView
	} from '@journalix/core';
	import { useApp } from '../app/context.ts';
	import { saveFile } from '../app/save-file.ts';
	import Button from '../primitives/Button.svelte';
	import Tabs from '../primitives/Tabs.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import ConfirmDialog from '../primitives/ConfirmDialog.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import StatusBadge from './parts/StatusBadge.svelte';
	import Pnl from './parts/Pnl.svelte';

	const { journal, env, toaster } = useApp();
	const tz = $derived(journal.settings.timeZone);

	type Quick = 'all' | 'open' | 'closed' | 'win' | 'loss';
	type SortKey = 'opened' | 'symbol' | 'strategy' | 'pnl' | 'r' | 'hold';

	let quick = $state<Quick>('all');
	let search = $state('');
	let sortKey = $state<SortKey>('opened');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let page = $state(0);
	let selected = $state<string[]>([]);
	let confirmBulk = $state(false);
	const PAGE_SIZE = 50;

	const counts = $derived({
		all: journal.filtered.length,
		open: journal.filtered.filter((v) => v.metrics.status !== 'closed').length,
		closed: journal.filtered.filter((v) => v.metrics.status === 'closed').length,
		win: journal.filtered.filter((v) => v.metrics.outcome === 'win').length,
		loss: journal.filtered.filter((v) => v.metrics.outcome === 'loss').length
	});

	const rows = $derived.by<TradeView[]>(() => {
		const needle = search.trim().toUpperCase();
		const list = journal.filtered.filter((v) => {
			if (quick === 'open' && v.metrics.status === 'closed') return false;
			if (quick === 'closed' && v.metrics.status !== 'closed') return false;
			if ((quick === 'win' || quick === 'loss') && v.metrics.outcome !== quick) return false;
			if (needle) {
				const hay =
					`${v.trade.underlying} ${STRATEGIES[v.metrics.strategy].label} ${v.trade.thesis}`.toUpperCase();
				if (!hay.includes(needle)) return false;
			}
			return true;
		});
		const dir = sortDir === 'asc' ? 1 : -1;
		const key = (v: TradeView): number | string => {
			switch (sortKey) {
				case 'opened':
					return Date.parse(v.metrics.openedAt ?? v.trade.createdAt);
				case 'symbol':
					return v.trade.underlying;
				case 'strategy':
					return STRATEGIES[v.metrics.strategy].label;
				case 'pnl':
					return v.metrics.netPnl;
				case 'r':
					return v.metrics.rMultiple ?? Number.NEGATIVE_INFINITY;
				case 'hold':
					return v.metrics.holdMs ?? Number.NEGATIVE_INFINITY;
			}
		};
		return [...list].sort((a, b) => {
			const ka = key(a);
			const kb = key(b);
			return (typeof ka === 'string' ? ka.localeCompare(String(kb)) : ka - Number(kb)) * dir;
		});
	});

	const pages = $derived(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
	const visible = $derived(rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));

	$effect(() => {
		// Back to the first page whenever the result set changes shape.
		void quick;
		void search;
		void journal.filter;
		page = 0;
	});

	function sortBy(key: SortKey): void {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = key === 'symbol' || key === 'strategy' ? 'asc' : 'desc';
		}
	}

	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		return sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
	}

	const allVisibleSelected = $derived(
		visible.length > 0 && visible.every((v) => selected.includes(v.trade.id))
	);

	function toggleAll(): void {
		const ids = visible.map((v) => v.trade.id);
		selected = allVisibleSelected
			? selected.filter((id) => !ids.includes(id))
			: [...new Set([...selected, ...ids])];
	}

	function toggle(id: string): void {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	async function deleteSelected(): Promise<void> {
		const ids = [...selected];
		let failed = 0;
		for (const id of ids) {
			try {
				await journal.deleteTrade(id);
			} catch {
				failed++;
			}
		}
		selected = [];
		if (failed) toaster.error(`${failed} of ${ids.length} trades could not be deleted`);
		else toaster.success(`Deleted ${ids.length} ${ids.length === 1 ? 'trade' : 'trades'}`);
	}

	function csvCell(value: string | number | null): string {
		const s = value === null ? '' : String(value);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	}

	function exportCsv(): void {
		const header = [
			'Opened',
			'Closed',
			'Symbol',
			'Strategy',
			'Direction',
			'Status',
			'Quantity',
			'Avg entry',
			'Avg exit',
			'Gross P&L',
			'Fees',
			'Net P&L',
			'R',
			'Hold (min)',
			'Account',
			'Playbook',
			'Tags'
		];
		const lines = rows.map((v) =>
			[
				v.metrics.openedAt,
				v.metrics.closedAt,
				v.trade.underlying,
				STRATEGIES[v.metrics.strategy].label,
				v.metrics.direction,
				v.metrics.status,
				v.metrics.quantity,
				v.metrics.averageEntry,
				v.metrics.averageExit,
				v.metrics.grossPnl.toFixed(2),
				v.metrics.fees.toFixed(2),
				v.metrics.netPnl.toFixed(2),
				v.metrics.rMultiple === null ? null : v.metrics.rMultiple.toFixed(3),
				v.metrics.holdMs === null ? null : Math.round(v.metrics.holdMs / 60_000),
				journal.accountById.get(v.trade.accountId)?.name ?? '',
				v.trade.playbookId ? (journal.playbookById.get(v.trade.playbookId)?.name ?? '') : '',
				v.trade.tagIds.map((id) => journal.tagById.get(id)?.name ?? '').join('; ')
			]
				.map(csvCell)
				.join(',')
		);
		void saveFile(env, {
			name: `journalix-trades-${new Date().toISOString().slice(0, 10)}.csv`,
			contents: [header.join(','), ...lines].join('\n'),
			mime: 'text/csv;charset=utf-8'
		});
	}

	const TABS = $derived([
		{ value: 'all' as Quick, label: 'All', count: counts.all },
		{ value: 'open' as Quick, label: 'Open', count: counts.open },
		{ value: 'closed' as Quick, label: 'Closed', count: counts.closed },
		{ value: 'win' as Quick, label: 'Wins', count: counts.win },
		{ value: 'loss' as Quick, label: 'Losses', count: counts.loss }
	]);

	const currencyOf = (v: TradeView): string =>
		journal.accountById.get(v.trade.accountId)?.currency ?? 'USD';
</script>

<PageHeader
	title="Trades"
	description="Every trade with its computed result. Select a row to review it on the chart."
>
	{#snippet actions()}
		<Button onclick={exportCsv} disabled={rows.length === 0}>
			{#snippet icon()}<DownloadSimpleIcon size={16} />{/snippet}
			Export CSV
		</Button>
		<Button href={env.href({ name: 'trade-new' })} variant="primary">
			{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
			New trade
		</Button>
	{/snippet}
</PageHeader>

{#if journal.trades.length === 0}
	<EmptyState
		title="No trades yet"
		message="Log your first trade leg by leg, or load the sample journal from Settings to explore every report."
	>
		{#snippet icon()}<ListBulletsIcon size={28} />{/snippet}
		{#snippet actions()}
			<Button href={env.href({ name: 'trade-new' })} variant="primary">New trade</Button>
			<Button href={env.href({ name: 'settings', section: 'data' })}>Load sample data</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="toolbar">
		<Tabs label="Trade status" bind:value={quick} tabs={TABS} />
		<label class="search">
			<MagnifyingGlassIcon size={16} />
			<span class="visually-hidden">Search trades</span>
			<input type="search" placeholder="Search symbol, strategy or thesis" bind:value={search} />
		</label>
	</div>

	{#if selected.length > 0}
		<div class="bulk" role="region" aria-label="Selected trades">
			<span>{selected.length} selected</span>
			<Button size="sm" variant="danger" onclick={() => (confirmBulk = true)}
				>Delete selected</Button
			>
			<Button size="sm" variant="ghost" onclick={() => (selected = [])}>Clear selection</Button>
		</div>
	{/if}

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col" class="check">
						<input
							type="checkbox"
							checked={allVisibleSelected}
							onchange={toggleAll}
							aria-label="Select all trades on this page"
						/>
					</th>
					<th scope="col" aria-sort={ariaSort('opened')}
						><button type="button" onclick={() => sortBy('opened')}
							>Opened {#if sortKey === 'opened'}{#if sortDir === 'asc'}<CaretUpIcon
										size={12}
									/>{:else}<CaretDownIcon size={12} />{/if}{/if}</button
						></th
					>
					<th scope="col" aria-sort={ariaSort('symbol')}
						><button type="button" onclick={() => sortBy('symbol')}
							>Symbol {#if sortKey === 'symbol'}{#if sortDir === 'asc'}<CaretUpIcon
										size={12}
									/>{:else}<CaretDownIcon size={12} />{/if}{/if}</button
						></th
					>
					<th scope="col" aria-sort={ariaSort('strategy')}
						><button type="button" onclick={() => sortBy('strategy')}
							>Strategy {#if sortKey === 'strategy'}{#if sortDir === 'asc'}<CaretUpIcon
										size={12}
									/>{:else}<CaretDownIcon size={12} />{/if}{/if}</button
						></th
					>
					<th scope="col">Status</th>
					<th scope="col" class="r hide-sm">Size</th>
					<th scope="col" class="r hide-sm">Entry</th>
					<th scope="col" class="r hide-sm">Exit</th>
					<th scope="col" class="r" aria-sort={ariaSort('pnl')}
						><button type="button" onclick={() => sortBy('pnl')}
							>Net P&amp;L {#if sortKey === 'pnl'}{#if sortDir === 'asc'}<CaretUpIcon
										size={12}
									/>{:else}<CaretDownIcon size={12} />{/if}{/if}</button
						></th
					>
					<th scope="col" class="r" aria-sort={ariaSort('r')}
						><button type="button" onclick={() => sortBy('r')}
							>R {#if sortKey === 'r'}{#if sortDir === 'asc'}<CaretUpIcon
										size={12}
									/>{:else}<CaretDownIcon size={12} />{/if}{/if}</button
						></th
					>
					<th scope="col" class="r hide-sm" aria-sort={ariaSort('hold')}
						><button type="button" onclick={() => sortBy('hold')}
							>Held {#if sortKey === 'hold'}{#if sortDir === 'asc'}<CaretUpIcon
										size={12}
									/>{:else}<CaretDownIcon size={12} />{/if}{/if}</button
						></th
					>
				</tr>
			</thead>
			<tbody>
				{#each visible as v (v.trade.id)}
					{@const single = v.trade.legs.length === 1}
					<tr class:selected={selected.includes(v.trade.id)}>
						<td class="check"
							><input
								type="checkbox"
								checked={selected.includes(v.trade.id)}
								onchange={() => toggle(v.trade.id)}
								aria-label="Select {v.trade.underlying} trade"
							/></td
						>
						<td class="nowrap"
							>{formatDateTime(v.metrics.openedAt ?? v.trade.createdAt, tz, 'short')}
							<span class="muted"
								>{formatDateTime(v.metrics.openedAt ?? v.trade.createdAt, tz, 'time')}</span
							></td
						>
						<td
							><a class="symbol" href={env.href({ name: 'trade', id: v.trade.id })}
								>{v.trade.underlying}</a
							></td
						>
						<td class="nowrap"
							>{STRATEGIES[v.metrics.strategy].label}<span class="dir muted"
								>{v.metrics.direction === 'long' ? ' long' : ' short'}</span
							></td
						>
						<td><StatusBadge status={v.metrics.status} outcome={v.metrics.outcome} /></td>
						<td class="r num hide-sm">{formatQuantity(v.metrics.quantity)}</td>
						<td class="r num hide-sm"
							>{single
								? formatPrice(v.metrics.averageEntry)
								: formatMoney(Math.abs(v.metrics.openingCashflow), { currency: currencyOf(v) })}</td
						>
						<td class="r num hide-sm">{single ? formatPrice(v.metrics.averageExit) : '—'}</td>
						<td class="r"
							>{#if v.metrics.status === 'closed'}<Pnl
									value={v.metrics.netPnl}
									currency={currencyOf(v)}
								/>{:else}<span class="muted">—</span>{/if}</td
						>
						<td class="r num">{formatR(v.metrics.rMultiple)}</td>
						<td class="r num hide-sm">{formatDuration(v.metrics.holdMs)}</td>
					</tr>
				{:else}
					<tr><td colspan="11" class="none">No trades match. Change the filters or search.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if pages > 1}
		<nav class="pager" aria-label="Pages">
			<Button
				size="sm"
				variant="ghost"
				disabled={page === 0}
				onclick={() => (page = Math.max(0, page - 1))}>Previous</Button
			>
			<span class="num">Page {page + 1} of {pages}</span>
			<Button
				size="sm"
				variant="ghost"
				disabled={page >= pages - 1}
				onclick={() => (page = Math.min(pages - 1, page + 1))}>Next</Button
			>
		</nav>
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmBulk}
	title="Delete {selected.length} {selected.length === 1 ? 'trade' : 'trades'}?"
	message="The selected trades and all of their fills are removed. This can’t be undone."
	confirmLabel="Delete trades"
	onconfirm={deleteSelected}
/>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.toolbar :global(.tabs) {
		flex: 1;
		min-width: 0;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink-3);
		width: min(320px, 100%);
	}

	.search input {
		border: 0;
		background: transparent;
		outline: none;
		width: 100%;
		color: var(--color-ink);
	}

	.search:focus-within {
		outline: 2px solid var(--color-focus);
		outline-offset: 0;
	}

	.bulk {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		margin-bottom: var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--color-signal-soft);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.table-wrap {
		overflow-x: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
	}

	table {
		width: 100%;
		font-size: var(--text-sm);
	}

	th {
		position: sticky;
		top: 0;
		background: var(--color-surface);
		text-align: left;
		font-weight: 500;
		color: var(--color-ink-3);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		white-space: nowrap;
	}

	th button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 0;
		padding: 0;
		background: transparent;
		color: inherit;
		font: inherit;
	}

	th button:hover {
		color: var(--color-ink);
	}

	td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		vertical-align: middle;
	}

	tbody tr:hover {
		background: var(--color-surface-2);
	}

	tr.selected {
		background: var(--color-signal-soft);
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.check {
		width: 36px;
		padding-right: 0;
	}

	.check input {
		accent-color: var(--color-signal);
	}

	.r {
		text-align: right;
	}

	th.r button {
		flex-direction: row-reverse;
	}

	.nowrap {
		white-space: nowrap;
	}

	.symbol {
		font-weight: 600;
		text-decoration: none;
		color: var(--color-ink);
	}

	.symbol:hover {
		text-decoration: underline;
	}

	/* Make the whole row a target for the symbol link. */
	tbody tr {
		position: relative;
	}

	.symbol::after {
		content: '';
		position: absolute;
		inset: 0 0 0 40px;
	}

	.check input {
		position: relative;
		z-index: 1;
	}

	.muted {
		color: var(--color-ink-3);
	}

	.none {
		padding: var(--space-8);
		text-align: center;
		color: var(--color-ink-3);
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	@media (max-width: 760px) {
		.hide-sm {
			display: none;
		}
	}
</style>
