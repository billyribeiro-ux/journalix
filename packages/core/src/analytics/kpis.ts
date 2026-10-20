/**
 * Performance statistics over closed trades. Every figure is computed from net P&L
 * (after fees) unless its name says otherwise.
 */
import type { TradeView } from '../engine/position.ts';
import { mean, median, safeDivide, stdDev, sum } from '../util/math.ts';

export interface PerformanceStats {
	readonly trades: number;
	readonly wins: number;
	readonly losses: number;
	readonly breakevens: number;
	/** Wins ÷ (wins + losses); breakevens excluded. */
	readonly winRate: number | null;
	readonly netPnl: number;
	readonly grossPnl: number;
	readonly fees: number;
	readonly grossProfit: number;
	readonly grossLoss: number;
	readonly profitFactor: number | null;
	readonly averageWin: number | null;
	readonly averageLoss: number | null;
	/** Average win ÷ |average loss|. */
	readonly payoffRatio: number | null;
	/** Mean net P&L per trade. */
	readonly expectancy: number | null;
	readonly medianPnl: number | null;
	readonly largestWin: number | null;
	readonly largestLoss: number | null;
	readonly averageR: number | null;
	readonly totalR: number;
	readonly rTrades: number;
	/** Van Tharp System Quality Number: √N × mean(R) ÷ σ(R), N capped at 100. */
	readonly sqn: number | null;
	/** Kelly fraction W − (1 − W) ÷ payoff. */
	readonly kelly: number | null;
	readonly maxConsecutiveWins: number;
	readonly maxConsecutiveLosses: number;
	readonly averageHoldMs: number | null;
	readonly averageHoldWinMs: number | null;
	readonly averageHoldLossMs: number | null;
	readonly longTrades: number;
	readonly shortTrades: number;
	readonly longWinRate: number | null;
	readonly shortWinRate: number | null;
}

export function closedViews(views: readonly TradeView[]): TradeView[] {
	return views
		.filter((v) => v.metrics.status === 'closed' && v.metrics.closedAt !== null)
		.sort((a, b) => Date.parse(a.metrics.closedAt ?? '') - Date.parse(b.metrics.closedAt ?? ''));
}

function winRateOf(views: readonly TradeView[]): number | null {
	const w = views.filter((v) => v.metrics.outcome === 'win').length;
	const l = views.filter((v) => v.metrics.outcome === 'loss').length;
	return w + l === 0 ? null : w / (w + l);
}

export function computeStats(input: readonly TradeView[]): PerformanceStats {
	const views = closedViews(input);
	const pnls = views.map((v) => v.metrics.netPnl);
	const winners = views.filter((v) => v.metrics.outcome === 'win');
	const losers = views.filter((v) => v.metrics.outcome === 'loss');
	const winPnls = winners.map((v) => v.metrics.netPnl);
	const lossPnls = losers.map((v) => v.metrics.netPnl);

	const grossProfit = sum(views.filter((v) => v.metrics.netPnl > 0).map((v) => v.metrics.netPnl));
	const grossLoss = sum(views.filter((v) => v.metrics.netPnl < 0).map((v) => v.metrics.netPnl));
	const winRate = winRateOf(views);
	const averageWin = winPnls.length ? mean(winPnls) : null;
	const averageLoss = lossPnls.length ? mean(lossPnls) : null;
	const payoffRatio = averageWin !== null && averageLoss !== null ? safeDivide(averageWin, Math.abs(averageLoss)) : null;

	const rs = views.map((v) => v.metrics.rMultiple).filter((r): r is number => r !== null);
	const rStd = stdDev(rs);
	const sqn = rs.length >= 2 && rStd > 0 ? (Math.sqrt(Math.min(rs.length, 100)) * mean(rs)) / rStd : null;

	let maxWins = 0;
	let maxLosses = 0;
	let runWins = 0;
	let runLosses = 0;
	for (const v of views) {
		if (v.metrics.outcome === 'win') {
			runWins++;
			runLosses = 0;
		} else if (v.metrics.outcome === 'loss') {
			runLosses++;
			runWins = 0;
		}
		maxWins = Math.max(maxWins, runWins);
		maxLosses = Math.max(maxLosses, runLosses);
	}

	const hold = (vs: readonly TradeView[]): number | null => {
		const values = vs.map((v) => v.metrics.holdMs).filter((h): h is number => h !== null);
		return values.length ? mean(values) : null;
	};

	const longs = views.filter((v) => v.metrics.direction === 'long');
	const shorts = views.filter((v) => v.metrics.direction === 'short');

	return {
		trades: views.length,
		wins: winners.length,
		losses: losers.length,
		breakevens: views.filter((v) => v.metrics.outcome === 'breakeven').length,
		winRate,
		netPnl: sum(pnls),
		grossPnl: sum(views.map((v) => v.metrics.grossPnl)),
		fees: sum(views.map((v) => v.metrics.fees)),
		grossProfit,
		grossLoss,
		// No losses means the factor is unbounded; reported as null and rendered as "∞" when there are profits.
		profitFactor: grossLoss < 0 ? grossProfit / Math.abs(grossLoss) : null,
		averageWin,
		averageLoss,
		payoffRatio,
		expectancy: pnls.length ? mean(pnls) : null,
		medianPnl: pnls.length ? median(pnls) : null,
		largestWin: winPnls.length ? Math.max(...winPnls) : null,
		largestLoss: lossPnls.length ? Math.min(...lossPnls) : null,
		averageR: rs.length ? mean(rs) : null,
		totalR: sum(rs),
		rTrades: rs.length,
		sqn,
		kelly: winRate !== null && payoffRatio !== null && payoffRatio > 0 ? winRate - (1 - winRate) / payoffRatio : null,
		maxConsecutiveWins: maxWins,
		maxConsecutiveLosses: maxLosses,
		averageHoldMs: hold(views),
		averageHoldWinMs: hold(winners),
		averageHoldLossMs: hold(losers),
		longTrades: longs.length,
		shortTrades: shorts.length,
		longWinRate: winRateOf(longs),
		shortWinRate: winRateOf(shorts)
	};
}
