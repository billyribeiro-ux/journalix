/** Rounds to `digits` decimals, removing binary floating-point noise (e.g. 0.1 + 0.2). */
export function round(value: number, digits = 2): number {
	if (!Number.isFinite(value)) return value;
	const factor = 10 ** digits;
	return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

/** Collapses values within 1e-9 of zero to exactly zero. */
export function clean(value: number): number {
	return Math.abs(value) < 1e-9 ? 0 : value;
}

export function sum(values: readonly number[]): number {
	// Neumaier compensated summation keeps long P&L series exact to the cent.
	let total = 0;
	let compensation = 0;
	for (const x of values) {
		const t = total + x;
		compensation += Math.abs(total) >= Math.abs(x) ? total - t + x : x - t + total;
		total = t;
	}
	return total + compensation;
}

export function mean(values: readonly number[]): number {
	return values.length === 0 ? 0 : sum(values) / values.length;
}

/** Sample standard deviation (n − 1). Returns 0 for fewer than two values. */
export function stdDev(values: readonly number[]): number {
	if (values.length < 2) return 0;
	const m = mean(values);
	return Math.sqrt(sum(values.map((x) => (x - m) ** 2)) / (values.length - 1));
}

/** Downside deviation against a target (default 0), using all n observations. */
export function downsideDeviation(values: readonly number[], target = 0): number {
	if (values.length === 0) return 0;
	return Math.sqrt(sum(values.map((x) => Math.min(0, x - target) ** 2)) / values.length);
}

export function median(values: readonly number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
		: (sorted[mid] ?? 0);
}

/** Linear-interpolated quantile, q in [0, 1]. */
export function quantile(values: readonly number[], q: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	const a = sorted[lo] ?? 0;
	const b = sorted[hi] ?? 0;
	return a + (b - a) * (pos - lo);
}

export function safeDivide(numerator: number, denominator: number): number | null {
	return denominator === 0 || !Number.isFinite(denominator) ? null : numerator / denominator;
}
