import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from './types.ts';

/** Picks a bar size that shows a trade's whole life with a readable number of candles. */
export function chooseTimeframe(holdMs: number): Timeframe {
	const minutes = holdMs / 60_000;
	if (minutes <= 90) return '1m';
	if (minutes <= 6 * 60) return '5m';
	if (minutes <= 2 * 24 * 60) return '15m';
	if (minutes <= 10 * 24 * 60) return '1h';
	if (minutes <= 240 * 24 * 60) return '1D';
	return '1W';
}

/** Chart window around a trade: padded on both sides, never in the future. */
export function windowFor(
	openedAt: number,
	closedAt: number | null,
	timeframe: Timeframe,
	now: number = Date.now()
): { from: number; to: number } {
	const end = closedAt ?? now;
	const span = Math.max(0, end - openedAt);
	const barMs = TIMEFRAME_SECONDS[timeframe] * 1000;
	const minPadBars = timeframe === '1D' ? 40 : timeframe === '1W' ? 30 : 60;
	const pad = Math.max(span * 0.35, barMs * minPadBars);
	return { from: Math.floor(openedAt - pad), to: Math.min(now, Math.ceil(end + pad)) };
}

/** Floors an instant to its bar's open time for the given timeframe (UTC seconds). */
export function bucketStart(timeSeconds: number, timeframe: Timeframe): number {
	const size = TIMEFRAME_SECONDS[timeframe];
	if (timeframe === '1W') {
		// Weeks start Monday 00:00 UTC; the Unix epoch was a Thursday.
		const offset = 3 * 86_400;
		return Math.floor((timeSeconds + offset) / size) * size - offset;
	}
	return Math.floor(timeSeconds / size) * size;
}

/** Aggregates finer bars into a coarser timeframe. Input must be sorted by time. */
export function resample(bars: readonly Bar[], timeframe: Timeframe): Bar[] {
	const out: Bar[] = [];
	let current: { time: number; open: number; high: number; low: number; close: number; volume: number } | null = null;
	for (const b of bars) {
		const t = bucketStart(b.time, timeframe);
		if (current && current.time === t) {
			current.high = Math.max(current.high, b.high);
			current.low = Math.min(current.low, b.low);
			current.close = b.close;
			current.volume += b.volume;
		} else {
			if (current) out.push(current);
			current = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
		}
	}
	if (current) out.push(current);
	return out;
}

/** Sorts, de-duplicates by time and drops malformed bars. */
export function normalizeBars(bars: readonly Bar[], from: number, to: number): Bar[] {
	const byTime = new Map<number, Bar>();
	for (const b of bars) {
		const valid =
			Number.isFinite(b.time) &&
			[b.open, b.high, b.low, b.close].every((x) => Number.isFinite(x) && x > 0) &&
			b.high >= b.low;
		if (!valid) continue;
		if (b.time * 1000 < from - 7 * 86_400_000 || b.time * 1000 > to + 86_400_000) continue;
		const existing = byTime.get(b.time);
		if (!existing || b.volume > existing.volume) byTime.set(b.time, b);
	}
	return [...byTime.values()].sort((a, b) => a.time - b.time);
}
