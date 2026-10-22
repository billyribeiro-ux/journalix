<script lang="ts">
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import {
		attributePnl,
		classifyExecutions,
		entryGreeks,
		expiryInstant,
		formatDateTime,
		formatDuration,
		formatMoney,
		formatNumber,
		formatPercent,
		formatPrice,
		formatQuantity,
		formatR,
		openingStructure,
		premiumCaptured,
		STRATEGIES,
		yearsBetween,
		type PayoffLeg
	} from '@journalix/core';
	import {
		chooseTimeframe,
		TIMEFRAME_LABELS,
		TIMEFRAMES,
		windowFor,
		type Bar,
		type BarsResult,
		type Instrument,
		type Timeframe
	} from '@journalix/core/market-data';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import Badge from '../primitives/Badge.svelte';
	import Panel from '../primitives/Panel.svelte';
	import Select from '../primitives/Select.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import ConfirmDialog from '../primitives/ConfirmDialog.svelte';
	import Spinner from '../primitives/Spinner.svelte';
	import TradeChart from '../charts/TradeChart.svelte';
	import PayoffChart from '../charts/PayoffChart.svelte';
	import AttributionChart from '../charts/AttributionChart.svelte';
	import StatStrip from '../charts/StatStrip.svelte';
	import StatTile from '../charts/StatTile.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import StatusBadge from './parts/StatusBadge.svelte';
	import MetricList, { type MetricItem } from './parts/MetricList.svelte';
	import Stars from './parts/Stars.svelte';

	interface Props {
		tradeId: string;
	}

	let { tradeId }: Props = $props();
	const { journal, env, toaster } = useApp();

	const view = $derived(journal.view(tradeId));
	const tz = $derived(journal.settings.timeZone);
	const currency = $derived(
		view ? (journal.accountById.get(view.trade.accountId)?.currency ?? 'USD') : 'USD'
	);
	const money = (v: number | null, signed = false): string => formatMoney(v, { currency, signed });

	const hasOptions = $derived(
		view?.trade.legs.some((l) => l.kind === 'call' || l.kind === 'put') ?? false
	);
	const provider = $derived(journal.defaultProvider);

	// ---------- Chart data ----------
	type TfChoice = 'auto' | Timeframe;
	let tfChoice = $state<TfChoice>('auto');
	let chartMode = $state<'underlying' | 'contract'>('underlying');
	let contractLegId = $state<string>('');

	const autoTimeframe = $derived(
		view
			? chooseTimeframe(
					Math.max(
						60_000,
						view.metrics.holdMs ??
							Date.now() - Date.parse(view.metrics.openedAt ?? view.trade.createdAt)
					)
				)
			: '5m'
	);
	const timeframe = $derived<Timeframe>(tfChoice === 'auto' ? autoTimeframe : tfChoice);
	const optionLegs = $derived(
		view?.trade.legs.filter((l) => l.kind === 'call' || l.kind === 'put') ?? []
	);
	const contractLeg = $derived(
		optionLegs.find((l) => l.id === contractLegId) ?? optionLegs[0] ?? null
	);

	// Replaced wholesale by each fetch and never mutated, so the (large) bar arrays stay unproxied.
	let barsState = $state.raw<
		{ status: 'idle' | 'loading' } | { status: 'done'; result: BarsResult }
	>({ status: 'idle' });

	$effect(() => {
		const v = view;
		if (!v || !v.metrics.openedAt) return;
		const opened = Date.parse(v.metrics.openedAt);
		const closed = v.metrics.closedAt ? Date.parse(v.metrics.closedAt) : null;
		const win = windowFor(opened, closed, timeframe);
		const leg = chartMode === 'contract' ? contractLeg : null;
		const instrument: Instrument =
			leg &&
			leg.strike !== null &&
			leg.expiration !== null &&
			(leg.kind === 'call' || leg.kind === 'put')
				? {
						type: 'option',
						contract: {
							underlying: v.trade.underlying,
							expiration: leg.expiration,
							kind: leg.kind,
							strike: leg.strike
						}
					}
				: { type: 'equity', symbol: v.trade.underlying };
		const anchors = v.trade.executions
			.filter((e) => (leg ? e.legId === leg.id : true))
			.map((e) => {
				const fillLeg = v.trade.legs.find((l) => l.id === e.legId);
				const isOpt = fillLeg?.kind === 'call' || fillLeg?.kind === 'put';
				const price = leg ? e.price : isOpt ? e.underlyingPrice : e.price;
				return price && price > 0 ? { time: Date.parse(e.executedAt), price } : null;
			})
			.filter((a): a is { time: number; price: number } => a !== null);
		let cancelled = false;
		barsState = { status: 'loading' };
		journal.repo.bars
			.get({ instrument, timeframe, from: win.from, to: win.to, anchors }, null)
			.then((result) => {
				if (!cancelled) barsState = { status: 'done', result };
			})
			.catch((error: unknown) => {
				if (!cancelled)
					barsState = {
						status: 'done',
						result: {
							status: 'error',
							code: 'network',
							message: error instanceof Error ? error.message : 'Could not load bars'
						}
					};
			});
		return () => {
			cancelled = true;
		};
	});

	const bars = $derived<readonly Bar[] | null>(
		barsState.status === 'done' && barsState.result.status === 'ok' ? barsState.result.bars : null
	);
	const simulated = $derived(
		barsState.status === 'done' &&
			barsState.result.status === 'ok' &&
			barsState.result.provider.simulated
	);

	// A failed MFE/MAE save is reported once per trade, not on every re-run of the effect below.
	let excursionFailedFor: string | null = null;

	// MFE / MAE for single linear legs, computed once from real bars and stored on the trade.
	$effect(() => {
		const v = view;
		if (!v || !bars || bars.length === 0 || simulated || chartMode !== 'underlying') return;
		if (v.metrics.status !== 'closed' || v.trade.mfe !== null || v.trade.legs.length !== 1) return;
		const leg = v.trade.legs[0];
		if (!leg || leg.kind === 'call' || leg.kind === 'put') return;
		const entry = v.metrics.averageEntry;
		if (entry === null || !v.metrics.openedAt || !v.metrics.closedAt) return;
		const from = Date.parse(v.metrics.openedAt) / 1000;
		const to = Date.parse(v.metrics.closedAt) / 1000;
		const inTrade = bars.filter((b) => b.time >= from - 3600 && b.time <= to);
		if (inTrade.length === 0) return;
		const high = Math.max(...inTrade.map((b) => b.high));
		const low = Math.min(...inTrade.map((b) => b.low));
		const size = v.metrics.quantity * leg.multiplier;
		const long = v.metrics.direction === 'long';
		const mfe = (long ? high - entry : entry - low) * size;
		const mae = (long ? low - entry : entry - high) * size;
		const tradeKey = v.trade.id;
		void journal
			.saveTrade({ ...v.trade, mfe: Math.max(0, mfe), mae: Math.min(0, mae) })
			.catch((error: unknown) => {
				if (excursionFailedFor === tradeKey) return;
				excursionFailedFor = tradeKey;
				toaster.error(
					'Could not save the excursion figures',
					error instanceof Error ? error.message : undefined
				);
			});
	});

	// ---------- Options analysis ----------
	const greeks = $derived(
		view && hasOptions ? entryGreeks(view, journal.settings.riskFreeRate) : null
	);
	const attribution = $derived(
		view && hasOptions ? attributePnl(view, journal.settings.riskFreeRate) : null
	);
	const payoffLegs = $derived.by<PayoffLeg[]>(() => {
		if (!view || !hasOptions) return [];
		const now = Date.now();
		const ivByLeg = new Map(greeks?.legs.map((g) => [g.legId, g.iv]) ?? []);
		const structure = openingStructure(view.metrics.legs);
		return structure.map((s, i) => {
			const state = view.metrics.legs.filter((l) => l.peakQuantity !== 0)[i];
			const exp = state?.leg.expiration;
			const iv = state ? ivByLeg.get(state.leg.id) : undefined;
			const years = exp ? yearsBetween(now, expiryInstant(exp)) : 0;
			return { ...s, ...(years > 0 && iv ? { years, volatility: iv } : {}) };
		});
	});
	const spot = $derived(
		view ? (view.metrics.underlyingAtExit ?? view.metrics.underlyingAtEntry) : null
	);
	const payoffMarkers = $derived.by(() => {
		if (!view) return [];
		const out: { price: number; label: string }[] = [];
		if (view.metrics.underlyingAtEntry !== null)
			out.push({ price: view.metrics.underlyingAtEntry, label: 'Entry' });
		if (view.metrics.underlyingAtExit !== null && view.metrics.status === 'closed')
			out.push({ price: view.metrics.underlyingAtExit, label: 'Exit' });
		return out;
	});

	// ---------- Ledger ----------
	const ledger = $derived.by(() => {
		if (!view) return [];
		const roles = new Map<string, string>();
		for (const state of view.metrics.legs) {
			for (const [id, role] of classifyExecutions(state.leg, state.executions)) {
				roles.set(
					id,
					{ open: 'Entry', add: 'Add', reduce: 'Partial exit', close: 'Exit', flip: 'Flip' }[role]
				);
			}
		}
		return [...view.trade.executions]
			.sort((a, b) => Date.parse(a.executedAt) - Date.parse(b.executedAt))
			.map((e) => {
				const legIndex = view.trade.legs.findIndex((l) => l.id === e.legId);
				const leg = view.trade.legs[legIndex];
				const legLabel =
					leg && (leg.kind === 'call' || leg.kind === 'put')
						? `${formatPrice(leg.strike)}${leg.kind === 'call' ? 'C' : 'P'} ${leg.expiration ?? ''}`
						: leg?.kind === 'stock'
							? 'Shares'
							: (leg?.kind ?? '');
				const kindLabel =
					e.kind === 'expiration'
						? 'Expired'
						: e.kind === 'assignment'
							? 'Assigned'
							: e.kind === 'exercise'
								? 'Exercised'
								: null;
				return {
					e,
					legLabel,
					role: kindLabel ?? roles.get(e.id) ?? '',
					multiplier: leg?.multiplier ?? 1
				};
			});
	});

	const levelHistory = $derived(
		view ? [...view.trade.levels].sort((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt)) : []
	);
	const tags = $derived(
		view
			? view.trade.tagIds.map((id) => journal.tagById.get(id)).filter((t) => t !== undefined)
			: []
	);
	const playbook = $derived(
		view?.trade.playbookId ? journal.playbookById.get(view.trade.playbookId) : undefined
	);
	const account = $derived(view ? journal.accountById.get(view.trade.accountId) : undefined);

	const detailGroups = $derived.by<{ title: string; items: MetricItem[] }[]>(() => {
		if (!view) return [];
		const m = view.metrics;
		const single = view.trade.legs.length === 1;
		const position: MetricItem[] = [
			{
				label: 'Direction',
				value: `${m.direction === 'long' ? 'Long' : 'Short'}${m.entryType !== 'even' ? `, ${m.entryType}` : ''}`
			},
			{ label: 'Size', value: formatQuantity(m.quantity) },
			{ label: 'Opened', value: formatDateTime(m.openedAt, tz) },
			{ label: 'Closed', value: m.closedAt ? formatDateTime(m.closedAt, tz) : 'Open' },
			{ label: 'Adds and partial exits', value: `${m.adds} and ${m.partialExits}` }
		];
		const prices: MetricItem[] = [];
		if (m.averageEntry !== null && single)
			prices.push({ label: 'Average entry', value: formatPrice(m.averageEntry) });
		if (m.averageExit !== null && single)
			prices.push({ label: 'Average exit', value: formatPrice(m.averageExit) });
		if (m.initialStop !== null)
			prices.push({ label: 'Initial stop', value: formatPrice(m.initialStop) });
		if (m.initialTarget !== null)
			prices.push({ label: 'Initial target', value: formatPrice(m.initialTarget) });
		if (m.initialRisk !== null)
			prices.push({ label: `Initial risk (${m.riskSource})`, value: money(m.initialRisk) });
		if (m.plannedRewardRisk !== null)
			prices.push({
				label: 'Planned reward to risk',
				value: `${formatNumber(m.plannedRewardRisk, 2)} to 1`
			});
		const result: MetricItem[] = [
			{
				label: 'Gross P&L',
				value: money(m.grossPnl, true),
				tone: m.grossPnl > 0 ? 'gain' : m.grossPnl < 0 ? 'loss' : 'neutral'
			},
			{ label: 'Fees', value: money(m.fees) }
		];
		if (view.trade.mfe !== null)
			result.push({
				label: 'Max favourable excursion',
				value: money(view.trade.mfe, true),
				tone: 'gain'
			});
		if (view.trade.mae !== null)
			result.push({
				label: 'Max adverse excursion',
				value: money(view.trade.mae, true),
				tone: 'loss'
			});
		const options: MetricItem[] = [];
		if (hasOptions) {
			options.push({
				label: 'Max profit',
				value: m.maxProfit === null ? 'Unlimited' : money(m.maxProfit)
			});
			options.push({
				label: 'Max loss',
				value: m.maxLoss === null ? 'Unlimited' : money(m.maxLoss)
			});
			if (m.breakevens.length)
				options.push({
					label: 'Breakeven at expiry',
					value: m.breakevens.map((b) => formatPrice(b)).join(', ')
				});
			if (m.dteAtEntry !== null)
				options.push({ label: 'DTE at entry', value: String(m.dteAtEntry) });
			const captured = premiumCaptured(view);
			if (captured !== null)
				options.push({ label: 'Premium captured', value: formatPercent(captured) });
			options.push({
				label: 'Outcome at expiry',
				value: m.assigned
					? 'Assigned or exercised'
					: m.expiredWorthless
						? 'Expired'
						: m.status === 'closed'
							? 'Closed before expiry'
							: 'Open'
			});
		}
		return [
			{ title: 'Position', items: position },
			{ title: 'Result', items: result },
			{ title: 'Prices and risk', items: prices },
			{ title: 'Option structure', items: options }
		].filter((g) => g.items.length > 0);
	});

	let confirmDelete = $state(false);

	async function remove(): Promise<void> {
		try {
			await journal.deleteTrade(tradeId);
			toaster.success('Trade deleted');
			await env.navigate({ name: 'trades' }, { replace: true });
		} catch (error) {
			toaster.error(
				'Could not delete the trade',
				error instanceof Error ? error.message : undefined
			);
		}
	}

	const tfOptions = $derived([
		{ value: 'auto' as TfChoice, label: `Auto (${TIMEFRAME_LABELS[autoTimeframe]})` },
		...TIMEFRAMES.map((t) => ({ value: t as TfChoice, label: TIMEFRAME_LABELS[t] }))
	]);
	const barsMessage = $derived.by(() => {
		if (barsState.status !== 'done') return null;
		const r = barsState.result;
		if (r.status === 'no-provider') return 'no-provider';
		if (r.status === 'error') return r.message;
		if (r.bars.length === 0) return 'The provider returned no bars for this window.';
		return null;
	});
</script>

{#if !view}
	<EmptyState title="Trade not found" message="It may have been deleted, or the link is wrong.">
		{#snippet actions()}<Button href={env.href({ name: 'trades' })}>Back to trades</Button
			>{/snippet}
	</EmptyState>
{:else}
	{const m = $derived(view.metrics)}
	<PageHeader
		title="{view.trade.underlying} {STRATEGIES[m.strategy].label.toLowerCase()}"
		back={{ href: env.href({ name: 'trades' }), label: 'Trades' }}
	>
		<div class="meta">
			<StatusBadge status={m.status} outcome={m.outcome} />
			{#if account}<span>{account.name}</span>{/if}
			{#if m.openedAt}<span>{formatDateTime(m.openedAt, tz, 'date')}</span>{/if}
			{#if playbook}<Badge color={playbook.color}>{playbook.name}</Badge>{/if}
			{#each tags as tag (tag.id)}<Badge color={tag.color}>{tag.name}</Badge>{/each}
		</div>
		{#snippet actions()}
			<Button href={env.href({ name: 'trade-edit', id: tradeId })}>
				{#snippet icon()}<PencilSimpleIcon size={16} />{/snippet}
				Edit
			</Button>
			<Button href={env.href({ name: 'trade-new', duplicateOf: tradeId })} variant="ghost">
				{#snippet icon()}<CopyIcon size={16} />{/snippet}
				Duplicate
			</Button>
			<Button variant="danger" onclick={() => (confirmDelete = true)}>
				{#snippet icon()}<TrashIcon size={16} />{/snippet}
				Delete
			</Button>
		{/snippet}
	</PageHeader>

	<StatStrip>
		<StatTile
			label={m.status === 'closed' ? 'Net P&L' : 'Realized so far'}
			value={money(m.status === 'closed' ? m.netPnl : m.grossPnl - m.fees, true)}
			tone={m.netPnl > 0 ? 'gain' : m.netPnl < 0 ? 'loss' : 'neutral'}
			hero
		/>
		<StatTile
			label="R-multiple"
			value={formatR(m.rMultiple)}
			detail={m.initialRisk !== null
				? `on ${money(m.initialRisk)} risk`
				: 'Set a stop or planned risk'}
		/>
		<StatTile
			label="Return on risk"
			value={m.initialRisk ? formatPercent(m.netPnl / m.initialRisk) : '—'}
		/>
		<StatTile
			label="Held"
			value={formatDuration(m.holdMs)}
			detail={m.status === 'open' ? 'Still open' : undefined}
		/>
		{#if hasOptions}
			<StatTile
				label={m.entryType === 'credit' ? 'Credit' : 'Debit'}
				value={money(Math.abs(m.openingCashflow))}
				detail="at open"
			/>
		{/if}
	</StatStrip>

	<div class="chart-panel">
		<Panel
			title="Chart"
			subtitle="Every fill at its price, the stop and target paths, and the planned risk and reward zones."
		>
			{#snippet actions()}
				{#if hasOptions}
					<Segmented
						label="Plot"
						size="sm"
						value={chartMode}
						options={[
							{ value: 'underlying', label: 'Underlying' },
							{ value: 'contract', label: 'Contract' }
						]}
						onchange={(v) => (chartMode = v)}
					/>
					{#if chartMode === 'contract' && optionLegs.length > 1}
						<div class="select-sm">
							<Select
								aria-label="Contract"
								bind:value={contractLegId}
								options={optionLegs.map((l) => ({
									value: l.id,
									label: `${formatPrice(l.strike)}${l.kind === 'call' ? 'C' : 'P'} ${l.expiration ?? ''}`
								}))}
							/>
						</div>
					{/if}
				{/if}
				<div class="select-sm">
					<Select aria-label="Timeframe" bind:value={tfChoice} options={tfOptions} />
				</div>
			{/snippet}
			<!-- One reserved line, so loading, a notice and an error never push the chart around. -->
			<div class="chart-status" aria-live="polite">
				{#if barsState.status === 'loading'}
					<p class="loading">
						<Spinner size={14} />
						<span>Loading {TIMEFRAME_LABELS[timeframe].toLowerCase()} bars</span>
						<span class="skeleton bar" aria-hidden="true"></span>
					</p>
				{:else if barsMessage === 'no-provider'}
					<p class="notice">
						Showing fills without candles. Add a market data provider in
						<a href={env.href({ name: 'settings', section: 'market-data' })}>Settings</a> to see the price
						action around this trade.
					</p>
				{:else if barsMessage}
					<p class="notice error" role="alert">
						<span class="notice-title">Candles unavailable.</span>
						{barsMessage}
					</p>
				{/if}
			</div>
			<TradeChart
				{view}
				{bars}
				{timeframe}
				timeZone={tz}
				{simulated}
				mode={chartMode}
				legId={contractLeg?.id}
				height={460}
			/>
			{#if provider && !simulated && barsState.status === 'done' && barsState.result.status === 'ok'}
				<p class="source">
					Bars from {barsState.result.provider.label}{barsState.result.cached ? ', cached' : ''}.
				</p>
			{/if}
		</Panel>
	</div>

	<div class="grid">
		<Panel title="Details">
			<div class="groups">
				{#each detailGroups as group (group.title)}
					<section class="group" aria-label={group.title}>
						<h3 class="sub">{group.title}</h3>
						<MetricList items={group.items} columns={1} />
					</section>
				{/each}
			</div>
		</Panel>

		<Panel title="Fills" flush>
			<div class="table-wrap scroll-fade">
				<table>
					<thead>
						<tr>
							<th scope="col">Time</th>
							<th scope="col">Action</th>
							{#if view.trade.legs.length > 1}<th scope="col">Leg</th>{/if}
							<th scope="col" class="r">Qty</th>
							<th scope="col" class="r">Price</th>
							<th scope="col" class="r">Value</th>
							<th scope="col" class="r">Fees</th>
							{#if hasOptions}<th scope="col" class="r">Underlying</th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each ledger as row (row.e.id)}
							<tr class="row-hover">
								<td class="nowrap">{formatDateTime(row.e.executedAt, tz)}</td>
								<td
									><span class="side">{row.e.side === 'buy' ? 'Buy' : 'Sell'}</span>
									<span class="muted">{row.role}</span></td
								>
								{#if view.trade.legs.length > 1}<td class="nowrap">{row.legLabel}</td>{/if}
								<td class="r num">{formatQuantity(row.e.quantity)}</td>
								<td class="r num">{formatPrice(row.e.price)}</td>
								<td class="r num"
									>{money(
										row.e.quantity * row.e.price * row.multiplier * (row.e.side === 'buy' ? -1 : 1),
										true
									)}</td
								>
								<td class="r num">{money(row.e.fees)}</td>
								{#if hasOptions}<td class="r num">{formatPrice(row.e.underlyingPrice)}</td>{/if}
							</tr>
							{#if row.e.note}
								<tr class="note-row"><td colspan="8">{row.e.note}</td></tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>
	</div>

	{#if hasOptions}
		<div class="grid">
			<Panel
				title="Payoff"
				subtitle="Profit and loss of the opening structure at expiry, and today from implied volatility at entry."
			>
				<PayoffChart
					legs={payoffLegs}
					{spot}
					rate={journal.settings.riskFreeRate}
					{currency}
					breakevens={m.breakevens}
					markers={payoffMarkers}
				/>
			</Panel>
			<Panel
				title="Greeks at entry"
				subtitle="Solved from your fill prices and the underlying price recorded at entry."
			>
				{#if greeks}
					<MetricList
						items={[
							{ label: 'Implied volatility', value: formatPercent(greeks.averageIv) },
							{ label: 'Delta (shares)', value: formatNumber(greeks.delta, 1) },
							{ label: 'Gamma (per $1)', value: formatNumber(greeks.gamma, 2) },
							{ label: 'Theta per day', value: money(greeks.theta, true) },
							{ label: 'Vega per vol point', value: money(greeks.vega, true) }
						]}
					/>
					{#if attribution}
						<h3 class="sub">Estimated P&amp;L attribution</h3>
						<AttributionChart {attribution} {currency} />
					{/if}
				{:else}
					<p class="muted">
						Record the underlying price on the opening fills to solve implied volatility and Greeks.
					</p>
				{/if}
			</Panel>
		</div>
	{/if}

	<div class="grid">
		<Panel title="Thesis and review">
			<div class="prose">
				<h3 class="sub">Thesis</h3>
				{#if view.trade.thesis}
					<p>{view.trade.thesis}</p>
				{:else}
					<p class="muted">
						No thesis recorded. <a href={env.href({ name: 'trade-edit', id: tradeId })}>Add one</a>
					</p>
				{/if}
				<h3 class="sub">Review</h3>
				{#if view.trade.review}
					<p>{view.trade.review}</p>
				{:else}
					<p class="muted">
						No review yet. <a href={env.href({ name: 'trade-edit', id: tradeId })}
							>Write what happened</a
						>
					</p>
				{/if}
				<div class="ratings">
					<span>Execution <Stars label="Execution rating" value={view.trade.rating} /></span>
					<span>Confidence <Stars label="Confidence" value={view.trade.confidence} /></span>
				</div>
			</div>
		</Panel>
		<Panel title="Stops and targets">
			{#if levelHistory.length === 0}
				<p class="muted">No stop or target recorded.</p>
			{:else}
				<ol class="levels" role="list">
					{#each levelHistory as level (level.id)}
						<li class={level.kind}>
							<span class="kind">{level.kind === 'stop' ? 'Stop' : 'Target'}</span>
							<span class="num price">{formatPrice(level.price)}</span>
							<span class="muted">{formatDateTime(level.setAt, tz)}</span>
							{#if level.note}<span class="note">{level.note}</span>{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</Panel>
	</div>

	<ConfirmDialog
		bind:open={confirmDelete}
		title="Delete this trade?"
		message="The trade, its fills and its stop history are removed. This can’t be undone."
		confirmLabel="Delete trade"
		onconfirm={remove}
	/>
{/if}

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-2);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.chart-panel {
		margin: var(--space-5) 0;
	}

	.select-sm :global(select) {
		min-height: 30px;
		font-size: var(--text-sm);
	}

	/* Reserves the line: the chart below never moves when this changes. */
	.chart-status {
		min-height: 2.5rem;
		margin-bottom: var(--space-2);
	}

	.chart-status p {
		margin: 0;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5rem;
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.loading .bar {
		flex: 1;
		max-width: 180px;
		height: 10px;
	}

	.notice {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
		color: var(--color-ink-2);
		font-size: var(--text-sm);
	}

	.notice.error {
		background: var(--color-loss-soft);
		color: var(--color-ink);
	}

	.notice-title {
		font-weight: 600;
		color: var(--color-loss-text);
	}

	.source {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	.grid {
		display: grid;
		gap: var(--space-5);
		margin-bottom: var(--space-5);
		/* Panels keep their own height: a short Fills table no longer stretches to match Details. */
		align-items: start;
	}

	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
		gap: var(--space-5) var(--space-6);
	}

	.group .sub {
		margin: 0 0 var(--space-1);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}

	@media (min-width: 1100px) {
		.grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	/* Sideways scroll on a narrow screen; the edge shadows say there is more to see. */
	.table-wrap {
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

	th {
		text-align: left;
		font-weight: 500;
		color: var(--color-ink-3);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		white-space: nowrap;
	}

	td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	th:first-child,
	td:first-child {
		padding-left: var(--space-5);
	}

	.r {
		text-align: right;
	}

	.nowrap {
		white-space: nowrap;
	}

	.side {
		font-weight: 600;
	}

	.note-row td {
		color: var(--color-ink-3);
		font-size: var(--text-xs);
		padding-top: 0;
	}

	.muted {
		color: var(--color-ink-3);
	}

	.sub {
		font-size: var(--text-sm);
		font-weight: 600;
		margin: var(--space-4) 0 var(--space-2);
		color: var(--color-ink-2);
	}

	.prose .sub:first-child {
		margin-top: 0;
	}

	.prose p {
		white-space: pre-wrap;
		max-width: var(--prose-max);
		line-height: var(--leading-normal);
		overflow-wrap: anywhere;
	}

	.ratings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-6);
		margin-top: var(--space-4);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.ratings span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.levels {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
	}

	.levels li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-left: 2px solid var(--color-line-strong);
		background: var(--color-surface-2);
	}

	.levels .stop {
		border-left-color: var(--color-loss);
	}

	.levels .target {
		border-left-color: var(--color-gain);
	}

	.kind {
		font-weight: 600;
		min-width: 52px;
	}

	.price {
		font-weight: 500;
	}

	.note {
		flex-basis: 100%;
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}
</style>
