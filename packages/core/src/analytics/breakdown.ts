/**
 * Group-by reports: performance broken down by any trade dimension, plus histograms.
 */
import type { TradeView } from '../engine/position.ts';
import { closedViews } from './kpis.ts';
import { STRATEGIES } from '../options/strategy.ts';
import { zonedParts } from '../util/time.ts';
import { mean, sum } from '../util/math.ts';

export interface GroupStats {
	readonly key: string;
	readonly label: string;
	/** Stable sort position for ordinal dimensions (hours, weekdays, buckets). */
	readonly order: number;
	readonly trades: number;
	readonly wins: number;
	readonly losses: number;
	readonly winRate: number | null;
	readonly netPnl: number;
	readonly averagePnl: number;
	readonly profitFactor: number | null;
	readonly averageR: number | null;
	readonly grossProfit: number;
	readonly grossLoss: number;
}

export type Dimension =
	| 'strategy'
	| 'symbol'
	| 'weekday'
	| 'hour'
	| 'month'
	| 'direction'
	| 'entryType'
	| 'assetClass'
	| 'dte'
	| 'hold'
	| 'playbook'
	| 'tag'
	| 'bias'
	| 'outcomeAtExpiry';

export interface DimensionContext {
	readonly timeZone: string;
	readonly playbookNames: ReadonlyMap<string, string>;
	readonly tagNames: ReadonlyMap<string, string>;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

interface Bucket {
	readonly key: string;
	readonly label: string;
	readonly order: number;
}

export const DTE_BUCKETS: readonly { readonly max: number; readonly label: string }[] = [
	{ max: 0, label: '0 DTE' },
	{ max: 1, label: '1 DTE' },
	{ max: 7, label: '2–7' },
	{ max: 21, label: '8–21' },
	{ max: 45, label: '22–45' },
	{ max: 90, label: '46–90' },
	{ max: Number.POSITIVE_INFINITY, label: '90+' }
];

const HOLD_BUCKETS: readonly { readonly maxMs: number; readonly label: string }[] = [
	{ maxMs: 5 * 60_000, label: '< 5m' },
	{ maxMs: 30 * 60_000, label: '5–30m' },
	{ maxMs: 2 * 3_600_000, label: '30m–2h' },
	{ maxMs: 24 * 3_600_000, label: '2h–1d' },
	{ maxMs: 5 * 86_400_000, label: '1–5d' },
	{ maxMs: 30 * 86_400_000, label: '5–30d' },
	{ maxMs: Number.POSITIVE_INFINITY, label: '30d+' }
];

function bucketsFor(view: TradeView, dimension: Dimension, ctx: DimensionContext): Bucket[] {
	const { trade, metrics } = view;
	switch (dimension) {
		case 'strategy':
			return [{ key: metrics.strategy, label: STRATEGIES[metrics.strategy].label, order: 0 }];
		case 'symbol':
			return [{ key: trade.underlying, label: trade.underlying, order: 0 }];
		case 'weekday': {
			const wd = zonedParts(metrics.openedAt ?? '', ctx.timeZone).weekday;
			return [{ key: String(wd), label: WEEKDAY_LABELS[wd] ?? '?', order: wd === 0 ? 7 : wd }];
		}
		case 'hour': {
			const h = zonedParts(metrics.openedAt ?? '', ctx.timeZone).hour;
			return [{ key: String(h), label: `${String(h).padStart(2, '0')}:00`, order: h }];
		}
		case 'month': {
			const p = zonedParts(metrics.closedAt ?? '', ctx.timeZone);
			const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
			return [
				{
					key,
					label: `${MONTH_LABELS[p.month - 1]} ${String(p.year).slice(2)}`,
					order: p.year * 12 + p.month
				}
			];
		}
		case 'direction':
			return [
				{
					key: metrics.direction,
					label: metrics.direction === 'long' ? 'Long' : 'Short',
					order: metrics.direction === 'long' ? 0 : 1
				}
			];
		case 'entryType':
			return [
				{
					key: metrics.entryType,
					label:
						metrics.entryType === 'credit'
							? 'Credit'
							: metrics.entryType === 'debit'
								? 'Debit'
								: 'Even',
					order: metrics.entryType === 'debit' ? 0 : metrics.entryType === 'credit' ? 1 : 2
				}
			];
		case 'assetClass':
			return [
				{
					key: trade.assetClass,
					label: trade.assetClass[0]?.toUpperCase() + trade.assetClass.slice(1),
					order: 0
				}
			];
		case 'dte': {
			if (metrics.dteAtEntry === null) return [];
			const idx = DTE_BUCKETS.findIndex((b) => (metrics.dteAtEntry ?? 0) <= b.max);
			const b = DTE_BUCKETS[idx];
			return b ? [{ key: b.label, label: b.label, order: idx }] : [];
		}
		case 'hold': {
			if (metrics.holdMs === null) return [];
			const idx = HOLD_BUCKETS.findIndex((b) => (metrics.holdMs ?? 0) < b.maxMs);
			const b = HOLD_BUCKETS[idx];
			return b ? [{ key: b.label, label: b.label, order: idx }] : [];
		}
		case 'playbook': {
			const id = trade.playbookId;
			if (id === null) return [{ key: 'none', label: 'No playbook', order: 1 }];
			return [{ key: id, label: ctx.playbookNames.get(id) ?? 'Unknown playbook', order: 0 }];
		}
		case 'tag':
			return trade.tagIds.map((id) => ({
				key: id,
				label: ctx.tagNames.get(id) ?? 'Unknown tag',
				order: 0
			}));
		case 'bias':
			return [
				{
					key: metrics.bias,
					label: metrics.bias[0]?.toUpperCase() + metrics.bias.slice(1),
					order: 0
				}
			];
		case 'outcomeAtExpiry': {
			if (!trade.legs.some((l) => l.kind === 'call' || l.kind === 'put')) return [];
			if (metrics.assigned) return [{ key: 'assigned', label: 'Assigned / exercised', order: 2 }];
			if (metrics.expiredWorthless) return [{ key: 'expired', label: 'Expired', order: 1 }];
			return [{ key: 'closed', label: 'Closed early', order: 0 }];
		}
	}
}

const ORDINAL: ReadonlySet<Dimension> = new Set([
	'weekday',
	'hour',
	'month',
	'dte',
	'hold',
	'direction',
	'entryType',
	'outcomeAtExpiry'
]);

export function groupBy(
	views: readonly TradeView[],
	dimension: Dimension,
	ctx: DimensionContext
): GroupStats[] {
	const groups = new Map<string, { bucket: Bucket; views: TradeView[] }>();
	for (const view of closedViews(views)) {
		for (const bucket of bucketsFor(view, dimension, ctx)) {
			const g = groups.get(bucket.key);
			if (g) g.views.push(view);
			else groups.set(bucket.key, { bucket, views: [view] });
		}
	}
	const rows = [...groups.values()].map(({ bucket, views: vs }): GroupStats => {
		const pnls = vs.map((v) => v.metrics.netPnl);
		const wins = vs.filter((v) => v.metrics.outcome === 'win').length;
		const losses = vs.filter((v) => v.metrics.outcome === 'loss').length;
		const grossProfit = sum(pnls.filter((p) => p > 0));
		const grossLoss = sum(pnls.filter((p) => p < 0));
		const rs = vs.map((v) => v.metrics.rMultiple).filter((r): r is number => r !== null);
		return {
			key: bucket.key,
			label: bucket.label,
			order: bucket.order,
			trades: vs.length,
			wins,
			losses,
			winRate: wins + losses ? wins / (wins + losses) : null,
			netPnl: sum(pnls),
			averagePnl: mean(pnls),
			profitFactor: grossLoss < 0 ? grossProfit / Math.abs(grossLoss) : null,
			averageR: rs.length ? mean(rs) : null,
			grossProfit,
			grossLoss
		};
	});
	return ORDINAL.has(dimension)
		? rows.sort((a, b) => a.order - b.order)
		: rows.sort((a, b) => b.netPnl - a.netPnl || a.label.localeCompare(b.label));
}

export interface HistogramBin {
	readonly x0: number;
	readonly x1: number;
	readonly count: number;
	readonly tradeIds: readonly string[];
}

/** Fixed-width histogram of R-multiples, clamped to [min, max] with open-ended edge bins. */
export function rHistogram(
	views: readonly TradeView[],
	width = 0.5,
	min = -4,
	max = 6
): HistogramBin[] {
	const bins: { x0: number; x1: number; ids: string[] }[] = [];
	for (let x = min; x < max - 1e-9; x += width) bins.push({ x0: x, x1: x + width, ids: [] });
	for (const v of closedViews(views)) {
		const r = v.metrics.rMultiple;
		if (r === null) continue;
		const clamped = Math.min(max - 1e-9, Math.max(min, r));
		const idx = Math.floor((clamped - min) / width);
		bins[idx]?.ids.push(v.trade.id);
	}
	return bins.map((b) => ({ x0: b.x0, x1: b.x1, count: b.ids.length, tradeIds: b.ids }));
}

/** Histogram of net P&L with "nice" automatic bin widths. */
export function pnlHistogram(views: readonly TradeView[], targetBins = 24): HistogramBin[] {
	const closed = closedViews(views);
	if (closed.length === 0) return [];
	const pnls = closed.map((v) => v.metrics.netPnl);
	const lo = Math.min(...pnls);
	const hi = Math.max(...pnls);
	const span = Math.max(1, hi - lo);
	const raw = span / targetBins;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
	const start = Math.floor(lo / step) * step;
	const count = Math.max(1, Math.ceil((hi - start) / step + 1e-9));
	const bins = Array.from({ length: count }, (_, i) => ({
		x0: start + i * step,
		x1: start + (i + 1) * step,
		ids: [] as string[]
	}));
	for (const v of closed) {
		const idx = Math.min(count - 1, Math.floor((v.metrics.netPnl - start) / step));
		bins[idx]?.ids.push(v.trade.id);
	}
	return bins.map((b) => ({ x0: b.x0, x1: b.x1, count: b.ids.length, tradeIds: b.ids }));
}

/** Weekday × hour matrix of net P&L for heatmaps. */
export interface HeatCell {
	readonly weekday: number;
	readonly hour: number;
	readonly pnl: number;
	readonly trades: number;
}

export function weekdayHourMatrix(views: readonly TradeView[], timeZone: string): HeatCell[] {
	const map = new Map<string, { pnl: number[]; weekday: number; hour: number }>();
	for (const v of closedViews(views)) {
		const p = zonedParts(v.metrics.openedAt ?? '', timeZone);
		const key = `${p.weekday}:${p.hour}`;
		const cell = map.get(key) ?? { pnl: [], weekday: p.weekday, hour: p.hour };
		cell.pnl.push(v.metrics.netPnl);
		map.set(key, cell);
	}
	return [...map.values()].map((c) => ({
		weekday: c.weekday,
		hour: c.hour,
		pnl: sum(c.pnl),
		trades: c.pnl.length
	}));
}
