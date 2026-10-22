/**
 * Shared, framework-free helpers for the analytics charts: bar geometry, tick density,
 * diverging fills and keyboard navigation. d3 is used for math only; every chart renders
 * its SVG with Svelte markup.
 */
import { formatMoney, formatNumber } from '@journalix/core';

export type BarDirection = 'up' | 'down' | 'left' | 'right';

export interface Corners {
	readonly tl?: number;
	readonly tr?: number;
	readonly br?: number;
	readonly bl?: number;
}

/** A positioned axis tick, ready to draw. */
export interface AxisTick {
	readonly key: string;
	/** Pixel position along the axis. */
	readonly pos: number;
	readonly label: string;
}

/** One row of a chart tooltip. `swatch` is a CSS colour (a token reference). */
export interface TooltipRow {
	readonly label: string;
	readonly value: string;
	readonly swatch?: string;
}

/** Metric a GroupBarChart plots. */
export type GroupMetric =
	'netPnl' | 'winRate' | 'averageR' | 'averagePnl' | 'profitFactor' | 'trades';

/** One trade on a ScatterChart. */
export interface ScatterPoint {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly outcome: 'win' | 'loss' | 'breakeven' | 'open';
	readonly label: string;
}

/** A legend entry. Text stays in ink; `color` paints only the swatch. */
export interface LegendItem {
	readonly key: string;
	readonly label: string;
	/** CSS colour, normally a token reference. */
	readonly color: string;
	readonly shape?: 'line' | 'dot' | 'square' | 'diamond' | 'ring';
}

/** An invisible, focusable hit area laid over a mark (pixels, relative to the chart wrapper). */
export interface HitTarget {
	readonly key: string;
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
	/** Full accessible description of the mark. */
	readonly label: string;
}

/** One row of a chart's accessible data table. */
export interface TableRow {
	readonly key: string;
	readonly cells: readonly string[];
}

/** Rectangle path with an individually rounded corner set. Radii are clamped to fit. */
export function roundedRectPath(
	x: number,
	y: number,
	w: number,
	h: number,
	corners: Corners
): string {
	if (!(w > 0) || !(h > 0)) return '';
	const cap = Math.min(w / 2, h / 2);
	const tl = Math.max(0, Math.min(corners.tl ?? 0, cap));
	const tr = Math.max(0, Math.min(corners.tr ?? 0, cap));
	const br = Math.max(0, Math.min(corners.br ?? 0, cap));
	const bl = Math.max(0, Math.min(corners.bl ?? 0, cap));
	const x1 = x + w;
	const y1 = y + h;
	const r = (n: number): string => String(Math.round(n * 100) / 100);
	return [
		`M${r(x + tl)},${r(y)}`,
		`H${r(x1 - tr)}`,
		tr ? `A${r(tr)},${r(tr)} 0 0 1 ${r(x1)},${r(y + tr)}` : '',
		`V${r(y1 - br)}`,
		br ? `A${r(br)},${r(br)} 0 0 1 ${r(x1 - br)},${r(y1)}` : '',
		`H${r(x + bl)}`,
		bl ? `A${r(bl)},${r(bl)} 0 0 1 ${r(x)},${r(y1 - bl)}` : '',
		`V${r(y + tl)}`,
		tl ? `A${r(tl)},${r(tl)} 0 0 1 ${r(x + tl)},${r(y)}` : '',
		'Z'
	].join('');
}

/**
 * A bar with its data end rounded and its baseline end square. `direction` is the way the
 * bar grows from its baseline: `up` rounds the top corners, `left` rounds the left corners.
 */
export function roundedBarPath(
	x: number,
	y: number,
	w: number,
	h: number,
	radius: number,
	direction: BarDirection
): string {
	switch (direction) {
		case 'up':
			return roundedRectPath(x, y, w, h, { tl: radius, tr: radius });
		case 'down':
			return roundedRectPath(x, y, w, h, { bl: radius, br: radius });
		case 'right':
			return roundedRectPath(x, y, w, h, { tr: radius, br: radius });
		case 'left':
			return roundedRectPath(x, y, w, h, { tl: radius, bl: radius });
	}
}

/** Vertical column from a baseline pixel to a value pixel, rounded at the data end. */
export function columnPath(
	x: number,
	w: number,
	yBase: number,
	yValue: number,
	radius = 4
): string {
	const h = Math.abs(yBase - yValue);
	if (h < 0.5) return roundedRectPath(x, yBase - 0.5, w, 1, {});
	return yValue <= yBase
		? roundedBarPath(x, yValue, w, h, radius, 'up')
		: roundedBarPath(x, yBase, w, h, radius, 'down');
}

/** Horizontal bar from a baseline pixel to a value pixel, rounded at the data end. */
export function rowBarPath(
	y: number,
	h: number,
	xBase: number,
	xValue: number,
	radius = 4
): string {
	const w = Math.abs(xValue - xBase);
	if (w < 0.5) return roundedRectPath(xBase - 0.5, y, 1, h, {});
	return xValue >= xBase
		? roundedBarPath(xBase, y, w, h, radius, 'right')
		: roundedBarPath(xValue, y, w, h, radius, 'left');
}

/** Tick count that keeps labels roughly `spacing` px apart. */
export function tickCount(length: number, spacing = 80): number {
	return Math.max(2, Math.floor(length / spacing));
}

/** Width estimate for a short label in IBM Plex Sans with tabular figures. */
export function textWidth(text: string, fontPx = 11): number {
	return text.length * fontPx * 0.6;
}

export function clamp(value: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, value));
}

/** Domain that always includes zero, padded so marks never touch the frame. */
export function domainWithZero(values: readonly number[], pad = 0.06): [number, number] {
	let lo = 0;
	let hi = 0;
	for (const v of values) {
		if (!Number.isFinite(v)) continue;
		if (v < lo) lo = v;
		if (v > hi) hi = v;
	}
	if (lo === hi) return [-1, 1];
	const span = hi - lo;
	return [lo < 0 ? lo - span * pad : 0, hi > 0 ? hi + span * pad : 0];
}

/** Compact currency for axis ticks: `$1.2K`, `−$500`. */
export function compactMoney(value: number, currency: string): string {
	if (Math.abs(value) < 1000) return formatMoney(value, { currency, digits: 0 });
	return formatMoney(value, { currency, compact: true });
}

/**
 * Axis labels for a run of money ticks. Compact first (`$1.2K`); when the span is so narrow that compact
 * rounding makes neighbouring ticks read the same (a one-trade equity curve: `$75K`, `$75K`, `$74.9K`,
 * `$74.9K`), widen to whole currency units, then to cents, until every tick is distinguishable.
 */
export function moneyTickLabels(values: readonly number[], currency: string): string[] {
	const distinct = (labels: readonly string[]): boolean => new Set(labels).size === labels.length;
	const compact = values.map((v) => compactMoney(v, currency));
	if (distinct(compact)) return compact;
	const whole = values.map((v) => formatMoney(v, { currency, digits: 0 }));
	if (distinct(whole)) return whole;
	return values.map((v) => formatMoney(v, { currency, digits: 2 }));
}

/** Compact signed currency for dense cells: `+$1.2K`, `−$80`. */
export function compactSignedMoney(value: number, currency: string): string {
	if (Math.abs(value) < 1000) return formatMoney(value, { currency, digits: 0, signed: true });
	return formatMoney(value, { currency, compact: true, signed: true });
}

/** Plain number tick with the digits a step needs. */
export function numberTick(value: number, step: number): string {
	const digits = step >= 1 || step === 0 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
	return formatNumber(value, digits);
}

/** Underlying-price label without a sign, digits by magnitude. */
export function priceLabel(value: number, currency: string): string {
	return formatMoney(value, { currency, digits: Math.abs(value) < 20 ? 2 : 0 });
}

/**
 * Diverging cell fill: gain or loss hue mixed into the surface, 12% at the faintest and 45%
 * at the month's (or grid's) largest absolute value. Zero returns the plain surface.
 */
export function divergingFill(value: number, maxAbs: number): string {
	if (!Number.isFinite(value) || value === 0 || !(maxAbs > 0)) return 'var(--color-surface)';
	const t = Math.min(1, Math.abs(value) / maxAbs);
	const pct = Math.round((12 + 33 * t) * 10) / 10;
	const hue = value > 0 ? 'var(--color-gain)' : 'var(--color-loss)';
	return `color-mix(in oklab, ${hue} ${pct}%, var(--color-surface))`;
}

/** Faint neutral fill for days that traded flat. */
export const FLAT_FILL = 'color-mix(in oklab, var(--color-neutral) 22%, var(--color-surface))';

/**
 * Linear keyboard navigation for a row of marks. Returns the next index, or `null` when the
 * key is not a navigation key.
 */
export function rovingIndex(key: string, current: number, count: number): number | null {
	if (count <= 0) return null;
	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
			return Math.min(count - 1, current + 1);
		case 'ArrowLeft':
		case 'ArrowUp':
			return Math.max(0, current - 1);
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/** Focuses the mark carrying `data-index={index}` inside `root`. */
export function focusMark(root: HTMLElement | undefined, index: number): void {
	const el = root?.querySelector<HTMLElement | SVGElement>(`[data-index="${index}"]`);
	el?.focus();
}

/**
 * Drops axis ticks whose labels would touch their neighbour (labels are centred on the
 * tick). Keeps the first tick and, when it fits, prefers keeping zero.
 */
export function spaceTicks(ticks: readonly AxisTick[], fontPx = 11, minGap = 10): AxisTick[] {
	const out: AxisTick[] = [];
	let lastRight = -Infinity;
	for (const t of ticks) {
		const half = textWidth(t.label, fontPx) / 2;
		if (t.pos - half < lastRight + minGap) continue;
		out.push(t);
		lastRight = t.pos + half;
	}
	return out;
}

/** Picks every n-th item so roughly `count` labels survive, always keeping the last one. */
export function thinLabels<T>(items: readonly T[], count: number): T[] {
	if (items.length <= count) return [...items];
	const step = Math.ceil(items.length / Math.max(1, count));
	const out: T[] = [];
	for (let i = 0; i < items.length; i += step) {
		const item = items[i];
		if (item !== undefined) out.push(item);
	}
	return out;
}

/** `YYYY-MM-DD` → UTC epoch ms at noon (safe from DST and zone shifts). */
export function dayMs(day: string): number {
	return Date.parse(`${day}T12:00:00Z`);
}

/** UTC epoch ms → `YYYY-MM-DD`. */
export function msToDay(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** Shift a `YYYY-MM-DD` key by whole days. */
export function shiftDay(day: string, days: number): string {
	return msToDay(dayMs(day) + days * 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, for a `YYYY-MM-DD` key. */
export function weekdayOf(day: string): number {
	return new Date(dayMs(day)).getUTCDay();
}

const longDay = new Intl.DateTimeFormat('en-US', {
	timeZone: 'UTC',
	weekday: 'long',
	month: 'long',
	day: 'numeric'
});

/** `Tuesday, October 14` for a `YYYY-MM-DD` key. */
export function weekdayMonthDay(day: string): string {
	return longDay.format(new Date(dayMs(day)));
}

/** `+$420.00 across 3 trades` */
export function pnlAcross(pnl: number, trades: number, currency: string): string {
	return `${formatMoney(pnl, { currency, signed: true })} across ${trades} ${trades === 1 ? 'trade' : 'trades'}`;
}
