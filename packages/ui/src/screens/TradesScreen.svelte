<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpDownIcon from 'phosphor-svelte/lib/CaretUpDownIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import {
		formatDateTime,
		formatDuration,
		formatMoney,
		formatPrice,
		formatQuantity,
		formatR,
		isFilterActive,
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
	// Back to the first page whenever the result set changes shape. A derived can be overridden by
	// the pager buttons and re-evaluates (to 0) when any of these change.
	let page = $derived.by(() => {
		void quick;
		void search;
		void journal.filter;
		return 0;
	});
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

	/** "Long call" already says long; only spreads and condors need the credit/debit side. */
	const showDirection = (v: TradeView): boolean => {
		const label = STRATEGIES[v.metrics.strategy].label.toLowerCase();
		return !label.includes('long') && !label.includes('short');
	};

	const globalFilterActive = $derived(isFilterActive(journal.filter));
	const firstShown = $derived(rows.length === 0 ? 0 : page * PAGE_SIZE + 1);
	const lastShown = $derived(page * PAGE_SIZE + visible.length);

	let tableTop: HTMLElement | null = null;
	function goToPage(next: number): void {
		page = Math.min(pages - 1, Math.max(0, next));
		// Land at the top of the new page instead of staring at the bottom of the old one.
		tableTop?.scrollIntoView({ block: 'nearest' });
	}

	function clearNarrowing(): void {
		quick = 'all';
		search = '';
		if (globalFilterActive) journal.resetFilter();
	}
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
			<MagnifyingGlassIcon size={16} aria-hidden="true" />
			<span class="visually-hidden">Search trades</span>
			<input type="search" placeholder="Search symbol, strategy or thesis" bind:value={search} />
		</label>
	</div>

	{#snippet sortButton(key: SortKey, label: string)}
		<button type="button" class="sort" onclick={() => sortBy(key)}>
			{label}
			<span class={['caret', { active: sortKey === key }]} aria-hidden="true">
				{#if sortKey !== key}<CaretUpDownIcon size={12} />{:else if sortDir === 'asc'}<CaretUpIcon
						size={12}
						weight="bold"
					/>{:else}<CaretDownIcon size={12} weight="bold" />{/if}
			</span>
		</button>
	{/snippet}

	<div class="table-region" role="tabpanel" id="panel-{quick}" aria-labelledby="tab-{quick}">
		<div
			class="table-anchor"
			{@attach (el) => {
				tableTop = el;
				return () => (tableTop = null);
			}}
		></div>
		{#if rows.length === 0}
			<EmptyState
				title="No trades match"
				message={search.trim()
					? `Nothing matches “${search.trim()}”${quick === 'all' ? '' : ' in this status'}${globalFilterActive ? ' with the current filters' : ''}.`
					: globalFilterActive
						? 'No trades fit the current filters.'
						: 'No trades have this status yet.'}
			>
				{#snippet icon()}<FunnelSimpleIcon size={28} />{/snippet}
				{#snippet actions()}
					<Button onclick={clearNarrowing}>
						{search.trim()
							? 'Clear search'
							: globalFilterActive
								? 'Clear filters'
								: 'Show all trades'}
					</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col" class="check">
								<label class="pick">
									<input
										type="checkbox"
										checked={allVisibleSelected}
										onchange={toggleAll}
										aria-label="Select all trades on this page"
									/>
								</label>
							</th>
							<th scope="col" class="col-date" aria-sort={ariaSort('opened')}
								>{@render sortButton('opened', 'Opened')}</th
							>
							<th scope="col" aria-sort={ariaSort('symbol')}
								>{@render sortButton('symbol', 'Symbol')}</th
							>
							<th scope="col" class="col-strategy" aria-sort={ariaSort('strategy')}
								>{@render sortButton('strategy', 'Strategy')}</th
							>
							<th scope="col" class="col-status">Status</th>
							<th scope="col" class="r col-detail">Size</th>
							<th scope="col" class="r col-detail">Entry</th>
							<th scope="col" class="r col-detail">Exit</th>
							<th scope="col" class="r" aria-sort={ariaSort('pnl')}
								>{@render sortButton('pnl', 'Net P&L')}</th
							>
							<th scope="col" class="r" aria-sort={ariaSort('r')}>{@render sortButton('r', 'R')}</th
							>
							<th scope="col" class="r col-hold" aria-sort={ariaSort('hold')}
								>{@render sortButton('hold', 'Held')}</th
							>
							<th scope="col" class="act"><span class="visually-hidden">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each visible as v (v.trade.id)}
							{const single = $derived(v.trade.legs.length === 1)}
							{const opened = $derived(v.metrics.openedAt ?? v.trade.createdAt)}
							<tr class={['row-hover', { selected: selected.includes(v.trade.id) }]}>
								<td class="check"
									><label class="pick"
										><input
											type="checkbox"
											checked={selected.includes(v.trade.id)}
											onchange={() => toggle(v.trade.id)}
											aria-label="Select {v.trade.underlying} trade"
										/></label
									></td
								>
								<td class="nowrap col-date"
									>{formatDateTime(opened, tz, 'short')}
									<span class="muted">{formatDateTime(opened, tz, 'time')}</span></td
								>
								<td class="sym-cell"
									><a class="symbol" href={env.href({ name: 'trade', id: v.trade.id })}
										>{v.trade.underlying}</a
									>
									<span class="sub muted"
										>{formatDateTime(opened, tz, 'short')} · {STRATEGIES[v.metrics.strategy]
											.label}</span
									></td
								>
								<td class="nowrap col-strategy"
									>{STRATEGIES[v.metrics.strategy].label}{#if showDirection(v)}<span
											class="dir muted">{v.metrics.direction === 'long' ? ' long' : ' short'}</span
										>{/if}</td
								>
								<td class="col-status"
									><StatusBadge status={v.metrics.status} outcome={v.metrics.outcome} /></td
								>
								<td class="r num col-detail">{formatQuantity(v.metrics.quantity)}</td>
								<td class="r num col-detail"
									>{#if single}{formatPrice(
											v.metrics.averageEntry
										)}{:else}{#if v.metrics.entryType !== 'even'}<span class="muted unit"
												>{v.metrics.entryType === 'credit' ? 'cr ' : 'db '}</span
											>{/if}{formatMoney(Math.abs(v.metrics.openingCashflow), {
											currency: currencyOf(v)
										})}{/if}</td
								>
								<td class="r num col-detail">{single ? formatPrice(v.metrics.averageExit) : '—'}</td
								>
								<td class="r"
									>{#if v.metrics.status === 'closed'}<Pnl
											value={v.metrics.netPnl}
											currency={currencyOf(v)}
										/>{:else}<span class="muted wide-only">—</span><span class="narrow-only"
											><StatusBadge status={v.metrics.status} outcome={v.metrics.outcome} /></span
										>{/if}</td
								>
								<td class="r num">{formatR(v.metrics.rMultiple)}</td>
								<td class="r num col-hold">{formatDuration(v.metrics.holdMs)}</td>
								<td class="act"
									><a
										class="row-action hover-reveal"
										href={env.href({ name: 'trade-edit', id: v.trade.id })}
										aria-label="Edit {v.trade.underlying} trade"
										data-tip="Edit"
										data-tip-pos="start"><PencilSimpleIcon size={16} /></a
									></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<nav class="pager" aria-label="Pages">
				<p class="range num" aria-live="polite">
					{#if pages > 1}Showing {firstShown}–{lastShown} of {rows.length}{:else}{rows.length}
						{rows.length === 1 ? 'trade' : 'trades'}{/if}
				</p>
				{#if pages > 1}
					<div class="pager-buttons">
						<Button
							size="sm"
							variant="ghost"
							disabled={page === 0}
							onclick={() => goToPage(page - 1)}>Previous</Button
						>
						<span class="num">Page {page + 1} of {pages}</span>
						<Button
							size="sm"
							variant="ghost"
							disabled={page >= pages - 1}
							onclick={() => goToPage(page + 1)}>Next</Button
						>
					</div>
				{/if}
			</nav>
		{/if}
	</div>

	{#if selected.length > 0}
		<div class="bulk" role="region" aria-label="Selected trades">
			<span class="num" aria-live="polite">{selected.length} selected</span>
			<Button size="sm" variant="danger" onclick={() => (confirmBulk = true)}
				>Delete selected</Button
			>
			<Button size="sm" variant="ghost" onclick={() => (selected = [])}>Clear selection</Button>
		</div>
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
		flex: 1 1 18rem;
		min-width: 0;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: var(--control);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink-3);
		width: min(320px, 100%);
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		.search {
			height: var(--control-touch);
		}

		.search input {
			font-size: max(16px, var(--text-base));
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.search:hover:not(:focus-within) {
			border-color: var(--color-ink-3);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.search input {
		border: 0;
		background: transparent;
		outline: none;
		width: 100%;
		min-width: 0;
		color: var(--color-ink);
	}

	.search input::placeholder {
		color: var(--color-ink-3);
	}

	.search:focus-within {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: 0;
		border-color: transparent;
		transition-delay: 0s;
	}

	/* Selection actions float over the bottom of the page, so selecting a row never moves the table. */
	.bulk {
		position: sticky;
		bottom: max(var(--space-4), env(safe-area-inset-bottom));
		z-index: var(--z-sticky);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		width: fit-content;
		max-width: 100%;
		margin-top: var(--space-4);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-pop);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.table-region {
		min-width: 0;
	}

	.table-anchor {
		scroll-margin-top: 4.5rem;
	}

	/*
	 * The table adapts to the width it actually gets (container query), not the viewport: with the
	 * sidebar open a 1100px window leaves the same room as a 800px tablet.
	 *   >= 960   everything
	 *   >= 700   drops Size / Entry / Exit
	 *   <  700   phone layout: symbol with date and strategy beneath it, Net P&L, R
	 */
	.table-wrap {
		/* Contains the visually-hidden "Actions" header, which would otherwise widen the page. */
		position: relative;
		container-type: inline-size;
		overflow-x: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
	}

	/* From 1024px the page (not the table) scrolls, so the header can stick under the filter bar. */
	@media (min-width: 1024px) {
		.table-wrap {
			overflow: clip;
		}

		/* Above the checkboxes, symbol links and edit links of the rows scrolling beneath. */
		th {
			position: sticky;
			top: 3.6rem;
			z-index: 3;
		}
	}

	table {
		width: 100%;
		font-size: var(--text-sm);
		border-collapse: separate;
		border-spacing: 0;
	}

	th {
		background: var(--color-surface);
		text-align: left;
		font-weight: 500;
		color: var(--color-ink-3);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line-strong);
		white-space: nowrap;
	}

	th[aria-sort='ascending'],
	th[aria-sort='descending'] {
		color: var(--color-ink);
	}

	.sort {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 24px;
		border: 0;
		border-radius: var(--radius-xs);
		padding: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		.sort {
			min-height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.sort:hover {
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.sort:focus-visible {
		transition-delay: 0s;
	}

	/* Every sortable column shows it can be sorted; the active one is darker and directional. */
	.caret {
		display: inline-flex;
		color: var(--color-ink-3);
		opacity: 0.55;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.caret.active {
		color: var(--color-ink);
		opacity: 1;
	}

	@media (hover: hover) and (pointer: fine) {
		.sort:hover .caret {
			opacity: 1;
			transition-delay: var(--hover-delay-tint);
		}
	}

	th.r .sort {
		flex-direction: row-reverse;
	}

	td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		vertical-align: middle;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	/* Selected: signal tint and a leading rule, so it survives hover and does not rely on the checkbox alone. */
	tr.selected {
		--hover-bg: var(--color-signal-soft);
		background: var(--color-signal-soft);
	}

	tr.selected td:first-child {
		box-shadow: inset 2px 0 0 var(--color-signal);
	}

	.check {
		width: 40px;
		padding-inline: var(--space-2) 0;
	}

	.pick {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		cursor: pointer;
	}

	@media (pointer: coarse) {
		.check {
			width: var(--control-touch);
			padding-inline: 0;
		}

		.pick {
			width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	.pick input {
		appearance: none;
		display: grid;
		place-content: center;
		width: 16px;
		height: 16px;
		margin: 0;
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-xs);
		background: var(--color-surface);
		cursor: pointer;
		position: relative;
		z-index: 2;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.pick input:hover:not(:checked) {
			border-color: var(--color-ink-3);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.pick input:checked {
		border-color: var(--color-signal-fg);
		background-color: var(--color-signal);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5 6.5 11.5 12.5 4.5' fill='none' stroke='%230f1b2d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-position: center;
		background-repeat: no-repeat;
	}

	.pick input:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: 2px;
		transition-delay: 0s;
	}

	@media (forced-colors: active) {
		.pick input:checked {
			forced-color-adjust: none;
			background-color: Highlight;
			border-color: Highlight;
		}
	}

	.r {
		text-align: right;
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

	/* The whole row opens the trade; the checkbox and edit link sit above this overlay. */
	tbody tr {
		position: relative;
	}

	.symbol::after {
		content: '';
		position: absolute;
		inset: 0 0 0 40px;
	}

	.symbol:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}

	.muted {
		color: var(--color-ink-3);
	}

	.unit {
		font-size: var(--text-xs);
	}

	.act {
		width: 40px;
		padding-inline: 0 var(--space-2);
		text-align: right;
	}

	.row-action {
		position: relative;
		z-index: 2;
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--color-ink-3);
		transition:
			opacity var(--duration-fast) var(--ease-out),
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.row-action:hover {
			background: var(--color-surface-3);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.row-action:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: 0;
		transition-delay: 0s;
	}

	@media (pointer: coarse) {
		.row-action {
			width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	/* Phone-only pieces are hidden until the narrow tier. */
	.sub,
	.narrow-only {
		display: none;
	}

	.sym-cell {
		white-space: nowrap;
	}

	@container (max-width: 959px) {
		.col-detail {
			display: none;
		}
	}

	@container (max-width: 699px) {
		.col-date,
		.col-strategy,
		.col-status,
		.col-hold,
		.act,
		.wide-only {
			display: none;
		}

		.sub {
			display: block;
			font-size: var(--text-xs);
			white-space: normal;
		}

		.narrow-only {
			display: inline;
		}

		.sym-cell {
			white-space: normal;
			width: 100%;
		}

		.symbol::after {
			inset: 0 0 0 var(--control-touch);
		}
	}

	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-3);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.pager p {
		margin: 0;
	}

	.pager-buttons {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>
