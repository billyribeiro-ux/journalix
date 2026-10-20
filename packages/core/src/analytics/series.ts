/**
 * Time series derived from closed trades: equity curve, drawdown, daily P&L and
 * risk-adjusted return ratios.
 */
import type { TradeView } from '../engine/position.ts';
import { closedViews } from './kpis.ts';
import { dayKey, addDays } from '../util/time.ts';
import { downsideDeviation, mean, stdDev, sum } from '../util/math.ts';

export interface EquityPoint {
	readonly tradeId: string;
	readonly at: string;
	readonly index: number;
	readonly pnl: number;
	readonly equity: number;
	readonly cumulativePnl: number;
	readonly peak: number;
	/** ≤ 0, in currency */
	readonly drawdown: number;
	/** ≤ 0, fraction of the running peak */
	readonly drawdownPct: number;
}

export interface DrawdownSummary {
	readonly maxDrawdown: number;
	readonly maxDrawdownPct: number;
	readonly maxDrawdownStart: string | null;
	readonly maxDrawdownTrough: string | null;
	readonly maxDrawdownRecovered: string | null;
	/** Longest stretch below a prior peak, in trades. */
	readonly longestUnderwaterTrades: number;
	readonly currentDrawdown: number;
	/** Net P&L ÷ |max drawdown| */
	readonly recoveryFactor: number | null;
}

export function equityCurve(views: readonly TradeView[], startingBalance: number): EquityPoint[] {
	const points: EquityPoint[] = [];
	let equity = startingBalance;
	let cumulative = 0;
	let peak = startingBalance;
	closedViews(views).forEach((v, index) => {
		cumulative += v.metrics.netPnl;
		equity = startingBalance + cumulative;
		peak = Math.max(peak, equity);
		const drawdown = Math.min(0, equity - peak);
		points.push({
			tradeId: v.trade.id,
			at: v.metrics.closedAt ?? '',
			index: index + 1,
			pnl: v.metrics.netPnl,
			equity,
			cumulativePnl: cumulative,
			peak,
			drawdown,
			drawdownPct: peak > 0 ? drawdown / peak : 0
		});
	});
	return points;
}

export function drawdownSummary(points: readonly EquityPoint[], startingBalance: number): DrawdownSummary {
	let maxDd = 0;
	let maxDdPct = 0;
	let troughIdx = -1;
	let peakAt: string | null = null;
	let runPeakAt: string | null = null;
	let underwater = 0;
	let longest = 0;
	let runPeak = startingBalance;

	points.forEach((p, i) => {
		if (p.equity >= runPeak) {
			runPeak = p.equity;
			runPeakAt = p.at;
			underwater = 0;
		} else {
			underwater++;
			longest = Math.max(longest, underwater);
		}
		if (p.drawdown < maxDd) {
			maxDd = p.drawdown;
			troughIdx = i;
			peakAt = runPeakAt;
		}
		maxDdPct = Math.min(maxDdPct, p.drawdownPct);
	});

	let recovered: string | null = null;
	if (troughIdx >= 0) {
		const trough = points[troughIdx];
		const target = trough ? trough.peak : 0;
		for (let i = troughIdx + 1; i < points.length; i++) {
			const p = points[i];
			if (p && p.equity >= target) {
				recovered = p.at;
				break;
			}
		}
	}

	const net = points[points.length - 1]?.cumulativePnl ?? 0;
	return {
		maxDrawdown: maxDd,
		maxDrawdownPct: maxDdPct,
		maxDrawdownStart: peakAt,
		maxDrawdownTrough: troughIdx >= 0 ? (points[troughIdx]?.at ?? null) : null,
		maxDrawdownRecovered: recovered,
		longestUnderwaterTrades: longest,
		currentDrawdown: points[points.length - 1]?.drawdown ?? 0,
		recoveryFactor: maxDd < 0 ? net / Math.abs(maxDd) : null
	};
}

export interface DailyPnl {
	readonly date: string;
	readonly pnl: number;
	readonly trades: number;
	readonly wins: number;
	readonly losses: number;
	readonly fees: number;
	readonly tradeIds: readonly string[];
}

/** Closed P&L bucketed by trading day (close time) in the user's time zone. */
export function dailyPnl(views: readonly TradeView[], timeZone: string): DailyPnl[] {
	const map = new Map<string, { pnl: number[]; wins: number; losses: number; fees: number[]; ids: string[] }>();
	for (const v of closedViews(views)) {
		const key = dayKey(v.metrics.closedAt ?? '', timeZone);
		let bucket = map.get(key);
		if (!bucket) {
			bucket = { pnl: [], wins: 0, losses: 0, fees: [], ids: [] };
			map.set(key, bucket);
		}
		bucket.pnl.push(v.metrics.netPnl);
		bucket.fees.push(v.metrics.fees);
		bucket.ids.push(v.trade.id);
		if (v.metrics.outcome === 'win') bucket.wins++;
		if (v.metrics.outcome === 'loss') bucket.losses++;
	}
	return [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, b]) => ({
			date,
			pnl: sum(b.pnl),
			trades: b.pnl.length,
			wins: b.wins,
			losses: b.losses,
			fees: sum(b.fees),
			tradeIds: b.ids
		}));
}

export interface RiskAdjustedStats {
	readonly tradingDays: number;
	readonly greenDays: number;
	readonly redDays: number;
	readonly greenDayRate: number | null;
	readonly bestDay: DailyPnl | null;
	readonly worstDay: DailyPnl | null;
	readonly averageDailyPnl: number | null;
	/** Annualised (√252) Sharpe on daily returns relative to equity at the start of each day. */
	readonly sharpe: number | null;
	readonly sortino: number | null;
	/** Annualised return ÷ |max drawdown %|. */
	readonly calmar: number | null;
	readonly dailyVolatility: number | null;
}

export function riskAdjusted(
	days: readonly DailyPnl[],
	startingBalance: number,
	riskFreeRate: number,
	maxDrawdownPct: number
): RiskAdjustedStats {
	const returns: number[] = [];
	let equity = startingBalance;
	for (const d of days) {
		if (equity > 0) returns.push(d.pnl / equity);
		equity += d.pnl;
	}
	const rfDaily = riskFreeRate / 252;
	const excess = returns.map((r) => r - rfDaily);
	const sd = stdDev(excess);
	const dd = downsideDeviation(excess);
	const sharpe = returns.length >= 2 && sd > 0 ? (mean(excess) / sd) * Math.sqrt(252) : null;
	const sortino = returns.length >= 2 && dd > 0 ? (mean(excess) / dd) * Math.sqrt(252) : null;

	const totalReturn = startingBalance > 0 ? (equity - startingBalance) / startingBalance : 0;
	const firstDay = days[0]?.date;
	const lastDay = days[days.length - 1]?.date;
	let calmar: number | null = null;
	if (firstDay && lastDay && maxDrawdownPct < 0 && startingBalance > 0) {
		const years = Math.max(1 / 252, (Date.parse(lastDay) - Date.parse(firstDay)) / (365.25 * 86_400_000));
		const annual = 1 + totalReturn > 0 ? (1 + totalReturn) ** (1 / years) - 1 : -1;
		calmar = annual / Math.abs(maxDrawdownPct);
	}

	const green = days.filter((d) => d.pnl > 0);
	const red = days.filter((d) => d.pnl < 0);
	const best = days.reduce<DailyPnl | null>((acc, d) => (acc === null || d.pnl > acc.pnl ? d : acc), null);
	const worst = days.reduce<DailyPnl | null>((acc, d) => (acc === null || d.pnl < acc.pnl ? d : acc), null);

	return {
		tradingDays: days.length,
		greenDays: green.length,
		redDays: red.length,
		greenDayRate: days.length ? green.length / days.length : null,
		bestDay: best,
		worstDay: worst,
		averageDailyPnl: days.length ? mean(days.map((d) => d.pnl)) : null,
		sharpe,
		sortino,
		calmar,
		dailyVolatility: returns.length >= 2 ? stdDev(returns) : null
	};
}

/** Every calendar day in [from, to] — for heatmaps that must show empty days. */
export function calendarRange(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to && out.length < 5000; d = addDays(d, 1)) out.push(d);
	return out;
}
