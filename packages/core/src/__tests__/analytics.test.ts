import { describe, expect, it } from 'vitest';
import { buildTradeViews } from '../engine/position.ts';
import { computeStats } from '../analytics/kpis.ts';
import { dailyPnl, drawdownSummary, equityCurve, riskAdjusted } from '../analytics/series.ts';
import { groupBy, pnlHistogram, rHistogram } from '../analytics/breakdown.ts';
import { applyFilter, EMPTY_FILTER } from '../analytics/filter.ts';
import { ENGINE, fill, leg, trade } from './fixtures.ts';

function stockTrade(day: string, entry: number, exit: number, qty = 100, hour = 14) {
	const s = leg({ kind: 'stock', underlying: 'AAPL' });
	return trade(
		[s],
		[
			fill(s, 'buy', qty, entry, `${day}T${hour}:00:00.000Z`),
			fill(s, 'sell', qty, exit, `${day}T${hour}:30:00.000Z`)
		],
		{ underlying: 'AAPL', plannedRisk: 100 }
	);
}

const trades = [
	stockTrade('2026-10-01', 10, 12), // +200
	stockTrade('2026-10-02', 10, 9), // −100
	stockTrade('2026-10-02', 10, 9.5), // −50
	stockTrade('2026-10-05', 10, 13), // +300
	stockTrade('2026-10-06', 10, 10) // 0 (breakeven)
];
const views = buildTradeViews(trades, ENGINE);

describe('performance stats', () => {
	const s = computeStats(views);
	it('counts outcomes and win rate excluding breakevens', () => {
		expect(s.trades).toBe(5);
		expect(s.wins).toBe(2);
		expect(s.losses).toBe(2);
		expect(s.breakevens).toBe(1);
		expect(s.winRate).toBeCloseTo(0.5, 12);
	});
	it('computes profit factor, payoff and expectancy', () => {
		expect(s.netPnl).toBeCloseTo(350, 10);
		expect(s.profitFactor).toBeCloseTo(500 / 150, 10);
		expect(s.averageWin).toBeCloseTo(250, 10);
		expect(s.averageLoss).toBeCloseTo(-75, 10);
		expect(s.payoffRatio).toBeCloseTo(250 / 75, 10);
		expect(s.expectancy).toBeCloseTo(70, 10);
		expect(s.averageR).toBeCloseTo(0.7, 10);
		expect(s.maxConsecutiveLosses).toBe(2);
		expect(s.kelly).toBeCloseTo(0.5 - 0.5 / (250 / 75), 10);
	});
});

describe('equity and drawdown', () => {
	const curve = equityCurve(views, 10_000);
	const dd = drawdownSummary(curve, 10_000);
	it('accumulates and measures the deepest drawdown', () => {
		expect(curve.map((p) => p.cumulativePnl)).toEqual([200, 100, 50, 350, 350]);
		expect(dd.maxDrawdown).toBeCloseTo(-150, 10);
		expect(dd.maxDrawdownPct).toBeCloseTo(-150 / 10_200, 10);
		expect(dd.recoveryFactor).toBeCloseTo(350 / 150, 10);
		expect(dd.maxDrawdownRecovered).not.toBeNull();
	});
	it('buckets by trading day and computes ratios', () => {
		const days = dailyPnl(views, 'America/New_York');
		expect(days.map((d) => d.date)).toEqual([
			'2026-10-01',
			'2026-10-02',
			'2026-10-05',
			'2026-10-06'
		]);
		expect(days[1]?.pnl).toBeCloseTo(-150, 10);
		const ra = riskAdjusted(days, 10_000, 0, dd.maxDrawdownPct);
		expect(ra.greenDays).toBe(2);
		expect(ra.redDays).toBe(1);
		expect(ra.sharpe).not.toBeNull();
	});
});

describe('breakdowns', () => {
	const ctx = { timeZone: 'America/New_York', playbookNames: new Map(), tagNames: new Map() };
	it('groups by weekday in order', () => {
		const rows = groupBy(views, 'weekday', ctx);
		expect(rows.map((r) => r.label)).toEqual(['Mon', 'Tue', 'Thu', 'Fri']);
	});
	it('builds histograms', () => {
		expect(rHistogram(views).reduce((a, b) => a + b.count, 0)).toBe(5);
		expect(pnlHistogram(views).reduce((a, b) => a + b.count, 0)).toBe(5);
	});
	it('filters by date range', () => {
		expect(
			applyFilter(
				views,
				{ ...EMPTY_FILTER, from: '2026-10-02', to: '2026-10-05' },
				'America/New_York'
			)
		).toHaveLength(3);
	});
});

describe('risk-adjusted returns', () => {
	it('counts idle weekdays as zero-return observations before annualising', () => {
		const day = (date: string, pnl: number) => ({
			date,
			pnl,
			trades: 1,
			wins: pnl > 0 ? 1 : 0,
			losses: pnl < 0 ? 1 : 0,
			fees: 0,
			tradeIds: []
		});
		// Two active days a week apart: Mon 2026-10-05 and Mon 2026-10-12, plus Tue 2026-10-13.
		const sparse = [day('2026-10-05', 300), day('2026-10-12', -100), day('2026-10-13', 300)];
		const result = riskAdjusted(sparse, 100_000, 0, -0.01);
		// 7 weekdays from Oct 5 to Oct 13 inclusive are observations, not 3.
		const dense = riskAdjusted(
			[
				day('2026-10-05', 300),
				day('2026-10-06', 0),
				day('2026-10-07', 0),
				day('2026-10-08', 0),
				day('2026-10-09', 0),
				day('2026-10-12', -100),
				day('2026-10-13', 300)
			],
			100_000,
			0,
			-0.01
		);
		expect(result.sharpe).not.toBeNull();
		expect(result.sharpe).toBeCloseTo(dense.sharpe ?? 0, 10);
		expect(result.tradingDays).toBe(3);
	});

	it('keeps weekend closes as their own observations', () => {
		const day = (date: string, pnl: number) => ({
			date,
			pnl,
			trades: 1,
			wins: 1,
			losses: 0,
			fees: 0,
			tradeIds: []
		});
		const withWeekend = riskAdjusted(
			[day('2026-10-09', 100), day('2026-10-10', 200), day('2026-10-12', -50)],
			10_000,
			0,
			-0.01
		);
		expect(withWeekend.sharpe).not.toBeNull();
		expect(withWeekend.tradingDays).toBe(3);
	});
});
