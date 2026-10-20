<script lang="ts">
	import {
		attributePnl,
		closedViews,
		dailyPnl,
		dayKey,
		drawdownSummary,
		entryGreeks,
		equityCurve,
		formatDuration,
		formatMoney,
		formatPercent,
		formatR,
		formatRatio,
		groupBy,
		pnlHistogram,
		premiumCaptured,
		rHistogram,
		riskAdjusted,
		weekdayHourMatrix,
		type Dimension,
		type GroupStats,
		type PnlAttribution
	} from '@strikebook/core';
	import type { ReportTab } from '../app/routes.ts';
	import { useApp } from '../app/context.ts';
	import Panel from '../primitives/Panel.svelte';
	import Tabs from '../primitives/Tabs.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import Button from '../primitives/Button.svelte';
	import StatStrip from '../charts/StatStrip.svelte';
	import StatTile from '../charts/StatTile.svelte';
	import EquityCurveChart from '../charts/EquityCurveChart.svelte';
	import HistogramChart from '../charts/HistogramChart.svelte';
	import GroupBarChart from '../charts/GroupBarChart.svelte';
	import ScatterChart from '../charts/ScatterChart.svelte';
	import WeekdayHourHeatmap from '../charts/WeekdayHourHeatmap.svelte';
	import YearHeatmap from '../charts/YearHeatmap.svelte';
	import AttributionChart from '../charts/AttributionChart.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import MetricList, { type MetricItem } from './parts/MetricList.svelte';
	import BreakdownTable from './reports/BreakdownTable.svelte';

	interface Props {
		tab?: ReportTab;
	}

	let { tab = 'overview' }: Props = $props();
	const { journal, env } = useApp();

	const TABS: readonly { value: ReportTab; label: string }[] = [
		{ value: 'overview', label: 'Overview' },
		{ value: 'options', label: 'Options' },
		{ value: 'time', label: 'Time' },
		{ value: 'risk', label: 'Risk' },
		{ value: 'tags', label: 'Setups and mistakes' },
		{ value: 'symbols', label: 'Symbols and accounts' }
	];

	// Tabs change the URL so a report can be bookmarked or shared with a mentor.
	let current = $derived<ReportTab>(tab);
	function selectTab(next: ReportTab): void {
		current = next;
		void env.navigate({ name: 'reports', tab: next }, { replace: true });
	}

	const tz = $derived(journal.settings.timeZone);
	const currency = $derived(journal.settings.baseCurrency);
	const money = (v: number | null, signed = false): string => formatMoney(v, { currency, signed });

	const views = $derived(journal.filtered);
	const closed = $derived(closedViews(views));
	const stats = $derived(journal.stats);
	const curve = $derived(equityCurve(views, journal.startingBalance));
	const dd = $derived(drawdownSummary(curve, journal.startingBalance));
	const days = $derived(dailyPnl(views, tz));
	const ratios = $derived(
		riskAdjusted(days, journal.startingBalance, journal.settings.riskFreeRate, dd.maxDrawdownPct)
	);
	const ctx = $derived({
		timeZone: tz,
		playbookNames: new Map(journal.playbooks.map((p) => [p.id, p.name])),
		tagNames: new Map(journal.tags.map((t) => [t.id, t.name]))
	});
	const by = (d: Dimension) => groupBy(views, d, ctx);

	const overview = $derived<MetricItem[]>([
		{ label: 'Closed trades', value: String(stats.trades) },
		{
			label: 'Wins / losses / breakeven',
			value: `${stats.wins} / ${stats.losses} / ${stats.breakevens}`
		},
		{ label: 'Win rate', value: formatPercent(stats.winRate) },
		{
			label: 'Net P&L',
			value: money(stats.netPnl, true),
			tone: stats.netPnl > 0 ? 'gain' : stats.netPnl < 0 ? 'loss' : 'neutral'
		},
		{ label: 'Gross P&L', value: money(stats.grossPnl, true) },
		{ label: 'Fees and commissions', value: money(stats.fees) },
		{ label: 'Gross profit', value: money(stats.grossProfit) },
		{ label: 'Gross loss', value: money(stats.grossLoss) },
		{ label: 'Profit factor', value: formatRatio(stats.profitFactor, 2, stats.grossProfit > 0) },
		{ label: 'Expectancy per trade', value: money(stats.expectancy, true) },
		{ label: 'Median trade', value: money(stats.medianPnl, true) },
		{ label: 'Average win', value: money(stats.averageWin, true) },
		{ label: 'Average loss', value: money(stats.averageLoss, true) },
		{ label: 'Payoff ratio', value: formatRatio(stats.payoffRatio) },
		{ label: 'Largest win', value: money(stats.largestWin, true) },
		{ label: 'Largest loss', value: money(stats.largestLoss, true) },
		{ label: 'Average R', value: formatR(stats.averageR) },
		{ label: 'Total R', value: formatR(stats.totalR) },
		{ label: 'Trades with R', value: String(stats.rTrades) },
		{
			label: 'SQN',
			value: formatRatio(stats.sqn),
			hint: 'System Quality Number: √N × mean R ÷ σ(R), N capped at 100'
		},
		{
			label: 'Kelly fraction',
			value: formatPercent(stats.kelly),
			hint: 'W − (1 − W) ÷ payoff ratio. A ceiling, not a sizing recommendation.'
		},
		{ label: 'Average hold', value: formatDuration(stats.averageHoldMs) },
		{ label: 'Average hold, winners', value: formatDuration(stats.averageHoldWinMs) },
		{ label: 'Average hold, losers', value: formatDuration(stats.averageHoldLossMs) },
		{
			label: 'Long trades',
			value: `${stats.longTrades} (${formatPercent(stats.longWinRate)} won)`
		},
		{
			label: 'Short trades',
			value: `${stats.shortTrades} (${formatPercent(stats.shortWinRate)} won)`
		},
		{ label: 'Longest winning streak', value: String(stats.maxConsecutiveWins) },
		{ label: 'Longest losing streak', value: String(stats.maxConsecutiveLosses) }
	]);

	const riskItems = $derived<MetricItem[]>([
		{ label: 'Max drawdown', value: money(dd.maxDrawdown), tone: 'loss' },
		{ label: 'Max drawdown %', value: formatPercent(dd.maxDrawdownPct) },
		{ label: 'Current drawdown', value: money(dd.currentDrawdown) },
		{ label: 'Longest time under water', value: `${dd.longestUnderwaterTrades} trades` },
		{ label: 'Recovery factor', value: formatRatio(dd.recoveryFactor) },
		{ label: 'Sharpe ratio (annualized)', value: formatRatio(ratios.sharpe) },
		{ label: 'Sortino ratio (annualized)', value: formatRatio(ratios.sortino) },
		{ label: 'Calmar ratio', value: formatRatio(ratios.calmar) },
		{ label: 'Daily volatility', value: formatPercent(ratios.dailyVolatility, 2) },
		{ label: 'Trading days', value: String(ratios.tradingDays) },
		{ label: 'Green days', value: `${ratios.greenDays} (${formatPercent(ratios.greenDayRate)})` },
		{
			label: 'Best day',
			value: ratios.bestDay ? `${money(ratios.bestDay.pnl, true)} on ${ratios.bestDay.date}` : '—'
		},
		{
			label: 'Worst day',
			value: ratios.worstDay
				? `${money(ratios.worstDay.pnl, true)} on ${ratios.worstDay.date}`
				: '—'
		},
		{ label: 'Average day', value: money(ratios.averageDailyPnl, true) }
	]);

	// ---------- Options ----------
	const optionViews = $derived(
		closed.filter((v) => v.trade.legs.some((l) => l.kind === 'call' || l.kind === 'put'))
	);
	const credit = $derived(optionViews.filter((v) => v.metrics.entryType === 'credit'));
	const captured = $derived(
		credit.map((v) => premiumCaptured(v)).filter((c): c is number => c !== null)
	);
	const avgCaptured = $derived(
		captured.length ? captured.reduce((a, b) => a + b, 0) / captured.length : null
	);
	const rate = $derived(journal.settings.riskFreeRate);
	const ivPoints = $derived(
		optionViews
			.map((v) => {
				const g = entryGreeks(v, rate);
				return g && v.metrics.rMultiple !== null
					? {
							id: v.trade.id,
							x: g.averageIv * 100,
							y: v.metrics.rMultiple,
							outcome: v.metrics.outcome,
							label: `${v.trade.underlying} ${v.metrics.dteAtEntry ?? ''} DTE`
						}
					: null;
			})
			.filter((p) => p !== null)
	);
	const totalAttribution = $derived.by<PnlAttribution | null>(() => {
		const parts = optionViews
			.map((v) => attributePnl(v, rate))
			.filter((a): a is PnlAttribution => a !== null);
		if (!parts.length) return null;
		const sum = (k: keyof PnlAttribution): number => parts.reduce((a, p) => a + p[k], 0);
		return {
			delta: sum('delta'),
			gamma: sum('gamma'),
			theta: sum('theta'),
			vega: sum('vega'),
			residual: sum('residual'),
			actual: sum('actual'),
			days: sum('days'),
			underlyingMove: 0,
			ivChange: parts.reduce((a, p) => a + p.ivChange, 0) / parts.length
		};
	});

	// ---------- Time ----------
	const holdPoints = $derived(
		closed
			.filter((v) => v.metrics.holdMs !== null && v.metrics.rMultiple !== null)
			.map((v) => ({
				id: v.trade.id,
				x: Math.max(1, (v.metrics.holdMs ?? 0) / 60_000),
				y: v.metrics.rMultiple ?? 0,
				outcome: v.metrics.outcome,
				label: v.trade.underlying
			}))
	);
	const heat = $derived(weekdayHourMatrix(views, tz));
	const today = $derived(dayKey(Date.now(), tz));

	// ---------- Risk ----------
	const excursionPoints = $derived(
		closed
			.filter((v) => v.trade.mae !== null && v.trade.mfe !== null)
			.map((v) => ({
				id: v.trade.id,
				x: v.trade.mae ?? 0,
				y: v.trade.mfe ?? 0,
				outcome: v.metrics.outcome,
				label: `${v.trade.underlying} ${money(v.metrics.netPnl, true)}`
			}))
	);

	// ---------- Tags ----------
	const tagRows = $derived(by('tag'));
	const categoryRows = (category: string) =>
		tagRows.filter((r) => journal.tagById.get(r.key)?.category === category);
	const mistakeCost = $derived(
		categoryRows('mistake').reduce((a, r) => a + Math.min(0, r.netPnl), 0)
	);

	// Accounts are ids on the trade, so aggregate them here rather than widening the core dimension set.
	const accountRows = $derived.by<GroupStats[]>(() =>
		journal.accounts
			.map((account, order) => {
				const subset = closed.filter((v) => v.trade.accountId === account.id);
				const pnl = subset.reduce((s, v) => s + v.metrics.netPnl, 0);
				const wins = subset.filter((v) => v.metrics.outcome === 'win').length;
				const losses = subset.filter((v) => v.metrics.outcome === 'loss').length;
				const grossProfit = subset.reduce((s, v) => s + Math.max(0, v.metrics.netPnl), 0);
				const grossLoss = subset.reduce((s, v) => s + Math.min(0, v.metrics.netPnl), 0);
				const rs = subset.flatMap((v) =>
					v.metrics.rMultiple === null ? [] : [v.metrics.rMultiple]
				);
				return {
					key: account.id,
					label: account.name,
					order,
					trades: subset.length,
					wins,
					losses,
					winRate: wins + losses ? wins / (wins + losses) : null,
					netPnl: pnl,
					averagePnl: subset.length ? pnl / subset.length : 0,
					profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : null,
					averageR: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : null,
					grossProfit,
					grossLoss
				};
			})
			.filter((row) => row.trades > 0)
			.sort((a, b) => b.netPnl - a.netPnl)
	);

	const openTrade = (id: string): void => void env.navigate({ name: 'trade', id });
</script>

<PageHeader title="Reports" description="Every report uses the filters at the top of the page." />

<Tabs label="Report" value={current} tabs={TABS} onchange={selectTab} />

<div class="tab-body" role="tabpanel" id="panel-{current}" aria-labelledby="tab-{current}">
	{#if closed.length === 0}
		<EmptyState
			title="No closed trades in this range"
			message="Reports are computed from closed trades. Close a trade or widen the filters."
		>
			{#snippet actions()}<Button onclick={() => journal.resetFilter()}>Clear filters</Button
				>{/snippet}
		</EmptyState>
	{:else if current === 'overview'}
		<StatStrip>
			<StatTile
				label="Net P&L"
				value={money(stats.netPnl, true)}
				tone={stats.netPnl > 0 ? 'gain' : stats.netPnl < 0 ? 'loss' : 'neutral'}
				hero
			/>
			<StatTile
				label="Win rate"
				value={formatPercent(stats.winRate)}
				detail="{stats.wins} of {stats.wins + stats.losses}"
			/>
			<StatTile
				label="Profit factor"
				value={formatRatio(stats.profitFactor, 2, stats.grossProfit > 0)}
			/>
			<StatTile
				label="Average R"
				value={formatR(stats.averageR)}
				detail="{stats.rTrades} trades with risk"
			/>
		</StatStrip>
		<div class="grid two">
			<Panel title="Equity curve">
				<EquityCurveChart
					points={curve}
					startingBalance={journal.startingBalance}
					{currency}
					timeZone={tz}
					height={300}
				/>
			</Panel>
			<Panel title="All statistics">
				<MetricList items={overview} columns={1} />
			</Panel>
		</div>
		<div class="grid two-even">
			<Panel title="R-multiple distribution" subtitle="Closed trades with a defined risk.">
				<HistogramChart bins={rHistogram(views)} unit="R" {currency} />
			</Panel>
			<Panel title="P&L distribution">
				<HistogramChart bins={pnlHistogram(views)} unit="currency" {currency} />
			</Panel>
		</div>
		<div class="grid two-even">
			<Panel title="By month">
				<GroupBarChart rows={by('month')} metric="netPnl" {currency} maxRows={24} />
			</Panel>
			<Panel title="Long and short">
				<BreakdownTable
					rows={by('direction')}
					{currency}
					label="Long versus short"
					heading="Direction"
				/>
				<div class="spacer"></div>
				<BreakdownTable
					rows={by('entryType')}
					{currency}
					label="Debit versus credit"
					heading="Entry"
				/>
			</Panel>
		</div>
	{:else if current === 'options'}
		{#if optionViews.length === 0}
			<EmptyState
				title="No closed option trades"
				message="Option reports appear once you close a trade with call or put legs."
			/>
		{:else}
			<StatStrip>
				<StatTile label="Option trades" value={String(optionViews.length)} />
				<StatTile
					label="Credit trades"
					value={String(credit.length)}
					detail="{optionViews.length - credit.length} debit"
				/>
				<StatTile
					label="Average premium captured"
					value={formatPercent(avgCaptured)}
					detail="credit trades, of max credit"
				/>
				<StatTile
					label="Expired worthless"
					value={String(optionViews.filter((v) => v.metrics.expiredWorthless).length)}
					detail="{optionViews.filter((v) => v.metrics.assigned).length} assigned"
				/>
			</StatStrip>
			<div class="grid two-even">
				<Panel title="By strategy">
					<GroupBarChart rows={by('strategy')} metric="netPnl" {currency} />
				</Panel>
				<Panel title="Win rate by strategy">
					<GroupBarChart rows={by('strategy')} metric="winRate" {currency} />
				</Panel>
			</div>
			<Panel title="Strategy breakdown">
				<BreakdownTable
					rows={by('strategy')}
					{currency}
					label="Results by strategy"
					heading="Strategy"
				/>
			</Panel>
			<div class="grid two-even">
				<Panel title="By days to expiration at entry">
					<GroupBarChart rows={by('dte')} metric="netPnl" {currency} />
				</Panel>
				<Panel title="By market bias">
					<GroupBarChart rows={by('bias')} metric="netPnl" {currency} />
				</Panel>
			</div>
			<div class="grid two-even">
				<Panel title="How positions ended">
					<BreakdownTable
						rows={by('outcomeAtExpiry')}
						{currency}
						label="Results by how the position ended"
						heading="Ending"
					/>
				</Panel>
				<Panel
					title="Implied volatility at entry versus R"
					subtitle="Trades with the underlying price recorded at entry."
				>
					{#if ivPoints.length}
						<ScatterChart
							points={ivPoints}
							xLabel="IV at entry (%)"
							yLabel="R-multiple"
							xFormat={(v) => `${v.toFixed(0)}%`}
							yFormat={(v) => formatR(v, 1)}
							onselect={openTrade}
						/>
					{:else}
						<p class="muted">Record the underlying price on fills to solve IV.</p>
					{/if}
				</Panel>
			</div>
			{#if totalAttribution}
				<Panel
					title="Where option P&L came from"
					subtitle="Estimated attribution summed over closed option trades with underlying prices at entry and exit."
				>
					<AttributionChart attribution={totalAttribution} {currency} />
				</Panel>
			{/if}
		{/if}
	{:else if current === 'time'}
		<div class="grid two-even">
			<Panel title="By weekday">
				<GroupBarChart rows={by('weekday')} metric="netPnl" {currency} />
			</Panel>
			<Panel title="By hour of entry" subtitle="In {tz}.">
				<GroupBarChart rows={by('hour')} metric="netPnl" {currency} />
			</Panel>
		</div>
		<Panel
			title="Weekday and hour"
			subtitle="Net P&L by when trades were opened. Cells show the number of trades."
		>
			<WeekdayHourHeatmap cells={heat} {currency} />
		</Panel>
		<div class="grid two-even">
			<Panel title="By holding time">
				<GroupBarChart rows={by('hold')} metric="netPnl" {currency} />
			</Panel>
			<Panel title="Holding time versus R">
				<ScatterChart
					points={holdPoints}
					xLabel="Held (minutes, log scale)"
					yLabel="R-multiple"
					xLog
					xFormat={(v) => formatDuration(v * 60_000)}
					yFormat={(v) => formatR(v, 1)}
					onselect={openTrade}
				/>
			</Panel>
		</div>
		<Panel title="Last 52 weeks">
			<YearHeatmap {days} endDate={today} weekStartsOn={journal.settings.weekStartsOn} {currency} />
		</Panel>
	{:else if current === 'risk'}
		<div class="grid two-even">
			<Panel title="Drawdown and risk-adjusted return">
				<MetricList items={riskItems} columns={1} />
			</Panel>
			<Panel title="Equity and drawdown">
				<EquityCurveChart
					points={curve}
					startingBalance={journal.startingBalance}
					{currency}
					timeZone={tz}
					height={320}
				/>
			</Panel>
		</div>
		<div class="grid two-even">
			<Panel title="R-multiple distribution">
				<HistogramChart bins={rHistogram(views, 0.25, -3, 5)} unit="R" {currency} />
			</Panel>
			<Panel
				title="Excursion"
				subtitle="Max adverse versus max favourable excursion, from market data on single-leg trades."
			>
				{#if excursionPoints.length}
					<ScatterChart
						points={excursionPoints}
						xLabel="Max adverse excursion"
						yLabel="Max favourable excursion"
						xFormat={(v) => money(v)}
						yFormat={(v) => money(v)}
						onselect={openTrade}
					/>
				{:else}
					<p class="muted">
						Open closed stock or futures trades with a market data provider configured; excursion is
						measured from the candles and saved.
					</p>
				{/if}
			</Panel>
		</div>
	{:else if current === 'tags'}
		<StatStrip>
			<StatTile
				label="Losses on trades tagged as mistakes"
				value={money(mistakeCost, true)}
				tone={mistakeCost < 0 ? 'loss' : 'neutral'}
				hero
			/>
			<StatTile
				label="Tagged trades"
				value={String(closed.filter((v) => v.trade.tagIds.length).length)}
				detail="of {closed.length} closed"
			/>
		</StatStrip>
		<div class="grid two-even">
			<Panel title="Setups">
				<GroupBarChart rows={categoryRows('setup')} metric="netPnl" {currency} />
			</Panel>
			<Panel title="Mistakes">
				<GroupBarChart rows={categoryRows('mistake')} metric="netPnl" {currency} />
			</Panel>
		</div>
		<div class="grid two-even">
			<Panel title="Emotions">
				<GroupBarChart rows={categoryRows('emotion')} metric="netPnl" {currency} />
			</Panel>
			<Panel title="By playbook">
				<GroupBarChart rows={by('playbook')} metric="netPnl" {currency} />
			</Panel>
		</div>
		<Panel title="All tags">
			<BreakdownTable rows={tagRows} {currency} label="Results by tag" heading="Tag" />
		</Panel>
	{:else if current === 'symbols'}
		<div class="grid two-even">
			<Panel title="By symbol">
				<GroupBarChart rows={by('symbol')} metric="netPnl" {currency} maxRows={15} />
			</Panel>
			<Panel title="By instrument">
				<BreakdownTable
					rows={by('assetClass')}
					{currency}
					label="Results by instrument"
					heading="Instrument"
				/>
			</Panel>
		</div>
		<Panel title="Symbol breakdown">
			<BreakdownTable rows={by('symbol')} {currency} label="Results by symbol" heading="Symbol" />
		</Panel>
		<Panel title="By account">
			<BreakdownTable rows={accountRows} {currency} label="Results by account" heading="Account" />
		</Panel>
	{/if}
</div>

<style>
	.tab-body {
		display: grid;
		gap: var(--space-5);
		margin-top: var(--space-5);
	}

	.grid {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1100px) {
		.grid.two {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}

		.grid.two-even {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	.spacer {
		height: var(--space-5);
	}

	.muted {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}
</style>
