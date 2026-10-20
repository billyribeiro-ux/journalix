<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import {
		dailyPnl,
		dayKey,
		drawdownSummary,
		equityCurve,
		formatDateTime,
		formatMoney,
		formatPercent,
		formatR,
		formatRatio,
		groupBy,
		isFilterActive,
		riskAdjusted,
		STRATEGIES
	} from '@strikebook/core';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import Panel from '../primitives/Panel.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import StatStrip from '../charts/StatStrip.svelte';
	import StatTile from '../charts/StatTile.svelte';
	import EquityCurveChart from '../charts/EquityCurveChart.svelte';
	import DailyPnlChart from '../charts/DailyPnlChart.svelte';
	import GroupBarChart from '../charts/GroupBarChart.svelte';
	import OutcomeBar from '../charts/OutcomeBar.svelte';
	import CalendarMonth from '../charts/CalendarMonth.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Pnl from './parts/Pnl.svelte';
	import StatusBadge from './parts/StatusBadge.svelte';

	const { journal, env } = useApp();
	const tz = $derived(journal.settings.timeZone);
	const currency = $derived(journal.settings.baseCurrency);
	const money = (v: number | null, signed = false): string => formatMoney(v, { currency, signed });

	const stats = $derived(journal.stats);
	const curve = $derived(equityCurve(journal.filtered, journal.startingBalance));
	const dd = $derived(drawdownSummary(curve, journal.startingBalance));
	const days = $derived(dailyPnl(journal.filtered, tz));
	const ratios = $derived(
		riskAdjusted(days, journal.startingBalance, journal.settings.riskFreeRate, dd.maxDrawdownPct)
	);
	const ctx = $derived({
		timeZone: tz,
		playbookNames: new Map(journal.playbooks.map((p) => [p.id, p.name])),
		tagNames: new Map(journal.tags.map((t) => [t.id, t.name]))
	});
	const byStrategy = $derived(groupBy(journal.filtered, 'strategy', ctx));
	const recent = $derived(
		[...journal.filtered]
			.filter((v) => v.metrics.status === 'closed')
			.sort((a, b) => Date.parse(b.metrics.closedAt ?? '') - Date.parse(a.metrics.closedAt ?? ''))
			.slice(0, 8)
	);
	const open = $derived(journal.filtered.filter((v) => v.metrics.status === 'open'));
	const sparkline = $derived(curve.slice(-40).map((p) => p.cumulativePnl));

	let xMode = $state<'time' | 'trade'>('time');
	const today = $derived(dayKey(Date.now(), tz));
	const lastDay = $derived(days[days.length - 1]?.date ?? today);
	let month = $derived(lastDay.slice(0, 7));

	function shiftMonth(delta: number): void {
		const [y, m] = month.split('-').map(Number);
		const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1));
		month = d.toISOString().slice(0, 7);
	}

	const monthLabel = $derived(
		new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);
	const monthPnl = $derived(
		days.filter((d) => d.date.startsWith(month)).reduce((a, d) => a + d.pnl, 0)
	);
	const filtered = $derived(isFilterActive(journal.filter));
</script>

<PageHeader
	title="Dashboard"
	description={filtered
		? 'Results for the current filters.'
		: 'All closed trades across your accounts.'}
>
	{#snippet actions()}
		<Button href={env.href({ name: 'trade-new' })} variant="primary">
			{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
			New trade
		</Button>
	{/snippet}
</PageHeader>

{#if journal.trades.length === 0}
	<section class="onboarding" aria-labelledby="start-title">
		<h2 id="start-title">Set up your journal</h2>
		<ol>
			<li>
				<h3>Create an account</h3>
				<p>Accounts keep separate balances and results, like a margin account and an IRA.</p>
				<Button href={env.href({ name: 'accounts' })}>Add account</Button>
			</li>
			<li>
				<h3>Connect market data</h3>
				<p>
					Add your own provider key to draw candles behind every trade. You can also use the
					simulator to try things out.
				</p>
				<Button href={env.href({ name: 'settings', section: 'market-data' })}>Add provider</Button>
			</li>
			<li>
				<h3>Log your first trade</h3>
				<p>
					Enter each leg and each fill — entries, adds and exits — with its time, price and fees.
				</p>
				<Button href={env.href({ name: 'trade-new' })} variant="primary">New trade</Button>
			</li>
		</ol>
		<p class="sample">
			Want to see every report first? <a href={env.href({ name: 'settings', section: 'data' })}
				>Load the sample journal</a
			>.
		</p>
	</section>
{:else}
	<StatStrip>
		<StatTile
			label="Net P&L"
			value={money(stats.netPnl, true)}
			tone={stats.netPnl > 0 ? 'gain' : stats.netPnl < 0 ? 'loss' : 'neutral'}
			detail="{stats.trades} closed trades"
			trend={sparkline}
			hero
		/>
		<StatTile
			label="Win rate"
			value={formatPercent(stats.winRate)}
			detail="{stats.wins} wins, {stats.losses} losses"
		/>
		<StatTile
			label="Profit factor"
			value={formatRatio(stats.profitFactor, 2, stats.grossProfit > 0)}
			detail="gross profit to gross loss"
		/>
		<StatTile
			label="Expectancy"
			value={money(stats.expectancy, true)}
			detail={stats.averageR !== null ? `${formatR(stats.averageR)} per trade` : 'per trade'}
		/>
		<StatTile
			label="Max drawdown"
			value={money(dd.maxDrawdown)}
			detail={formatPercent(dd.maxDrawdownPct)}
			tone={dd.maxDrawdown < 0 ? 'loss' : 'neutral'}
		/>
	</StatStrip>

	<div class="row two">
		<Panel
			title="Equity curve"
			subtitle="Account equity after each closed trade, with drawdown below."
		>
			{#snippet actions()}
				<Segmented
					label="X axis"
					size="sm"
					bind:value={xMode}
					options={[
						{ value: 'time', label: 'By date' },
						{ value: 'trade', label: 'By trade' }
					]}
				/>
			{/snippet}
			<EquityCurveChart
				points={curve}
				startingBalance={journal.startingBalance}
				{currency}
				timeZone={tz}
				{xMode}
				height={300}
			/>
		</Panel>
		<Panel title="Outcomes">
			<OutcomeBar wins={stats.wins} losses={stats.losses} breakevens={stats.breakevens} />
			<dl class="quick">
				<div>
					<dt>Average win</dt>
					<dd class="num gain">{money(stats.averageWin, true)}</dd>
				</div>
				<div>
					<dt>Average loss</dt>
					<dd class="num loss">{money(stats.averageLoss, true)}</dd>
				</div>
				<div>
					<dt>Payoff ratio</dt>
					<dd class="num">{formatRatio(stats.payoffRatio)}</dd>
				</div>
				<div>
					<dt>Largest win</dt>
					<dd class="num">{money(stats.largestWin, true)}</dd>
				</div>
				<div>
					<dt>Largest loss</dt>
					<dd class="num">{money(stats.largestLoss, true)}</dd>
				</div>
				<div>
					<dt>Green days</dt>
					<dd class="num">{formatPercent(ratios.greenDayRate)}</dd>
				</div>
				<div>
					<dt>Sharpe (annualized)</dt>
					<dd class="num">{formatRatio(ratios.sharpe)}</dd>
				</div>
				<div>
					<dt>SQN</dt>
					<dd class="num">{formatRatio(stats.sqn)}</dd>
				</div>
				<div>
					<dt>Longest losing streak</dt>
					<dd class="num">{stats.maxConsecutiveLosses}</dd>
				</div>
			</dl>
			<a class="more" href={env.href({ name: 'reports' })}>All reports</a>
		</Panel>
	</div>

	<div class="row">
		<Panel title="Daily P&L">
			<DailyPnlChart days={days.slice(-120)} {currency} height={200} />
		</Panel>
	</div>

	<div class="row two">
		<Panel title={monthLabel} subtitle="Net P&L by trading day. Select a day to see its trades.">
			{#snippet actions()}
				<Button size="sm" variant="ghost" onclick={() => shiftMonth(-1)} aria-label="Previous month"
					>Previous</Button
				>
				<Button size="sm" variant="ghost" onclick={() => shiftMonth(1)} aria-label="Next month"
					>Next</Button
				>
			{/snippet}
			<CalendarMonth
				{month}
				{days}
				weekStartsOn={journal.settings.weekStartsOn}
				{currency}
				onselect={(date) => {
					journal.setFilter({ from: date, to: date });
					void env.navigate({ name: 'trades' });
				}}
			/>
			<p class="month-total">Month: <Pnl value={monthPnl} {currency} /></p>
		</Panel>
		<Panel title="By strategy" subtitle="Net P&L for each detected strategy.">
			<GroupBarChart rows={byStrategy} metric="netPnl" {currency} maxRows={8} />
		</Panel>
	</div>

	<div class="row two">
		<Panel title="Recent closed trades" flush>
			<ul class="list" role="list">
				{#each recent as v (v.trade.id)}
					<li>
						<a href={env.href({ name: 'trade', id: v.trade.id })}>
							<span class="sym">{v.trade.underlying}</span>
							<span class="strat">{STRATEGIES[v.metrics.strategy].label}</span>
							<span class="when muted">{formatDateTime(v.metrics.closedAt, tz, 'short')}</span>
							<span class="r"><Pnl value={v.metrics.netPnl} {currency} /></span>
						</a>
					</li>
				{:else}
					<li class="none">No closed trades in this range.</li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Open positions" flush>
			<ul class="list" role="list">
				{#each open as v (v.trade.id)}
					<li>
						<a href={env.href({ name: 'trade', id: v.trade.id })}>
							<span class="sym">{v.trade.underlying}</span>
							<span class="strat">{STRATEGIES[v.metrics.strategy].label}</span>
							<span class="when muted">since {formatDateTime(v.metrics.openedAt, tz, 'short')}</span
							>
							<span class="r"
								><StatusBadge status={v.metrics.status} outcome={v.metrics.outcome} /></span
							>
						</a>
					</li>
				{:else}
					<li class="none">No open positions.</li>
				{/each}
			</ul>
		</Panel>
	</div>
{/if}

<style>
	.row {
		display: grid;
		gap: var(--space-5);
		margin-top: var(--space-5);
	}

	@media (min-width: 1100px) {
		.row.two {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}
	}

	.quick {
		display: grid;
		margin: var(--space-4) 0 0;
	}

	.quick div {
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
		font-weight: 500;
	}

	.gain {
		color: var(--color-gain);
	}

	.loss {
		color: var(--color-loss);
	}

	.more {
		display: inline-block;
		margin-top: var(--space-3);
		font-size: var(--text-sm);
	}

	.month-total {
		margin-top: var(--space-3);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.list {
		display: grid;
	}

	.list li + li {
		border-top: 1px solid var(--color-line);
	}

	.list a {
		display: grid;
		grid-template-columns: 64px 1fr auto auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		text-decoration: none;
		color: inherit;
	}

	.list a:hover {
		background: var(--color-surface-2);
	}

	.sym {
		font-weight: 600;
	}

	.strat {
		color: var(--color-ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.when {
		font-size: var(--text-sm);
	}

	.muted {
		color: var(--color-ink-3);
	}

	.r {
		text-align: right;
	}

	.none {
		padding: var(--space-6) var(--space-5);
		color: var(--color-ink-3);
	}

	.onboarding {
		padding: var(--space-8);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.onboarding h2 {
		font-size: var(--text-xl);
		margin-bottom: var(--space-6);
	}

	.onboarding ol {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-6);
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}

	.onboarding li {
		counter-increment: step;
		display: grid;
		gap: var(--space-2);
		align-content: start;
		justify-items: start;
		padding-top: var(--space-4);
		border-top: 2px solid var(--color-line-strong);
	}

	.onboarding li::before {
		content: counter(step);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-ink-3);
	}

	.onboarding h3 {
		font-size: var(--text-md);
	}

	.onboarding p {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		margin-bottom: var(--space-2);
	}

	.sample {
		margin-top: var(--space-8);
		color: var(--color-ink-3);
	}
</style>
