import { blackScholes } from './black-scholes.ts';
import type { LegKind } from '../domain/schemas.ts';

export interface PayoffLeg {
	readonly kind: LegKind;
	readonly strike: number | null;
	/** Signed size: + long, − short (contracts or shares). */
	readonly quantity: number;
	readonly multiplier: number;
	/** Average opening price per unit (premium per share for options). */
	readonly entryPrice: number;
	/** Years to this leg's expiry at the evaluation date (options only). */
	readonly years?: number;
	/** Volatility for theoretical (pre-expiry) valuation. */
	readonly volatility?: number;
}

function unitValueAtExpiry(leg: PayoffLeg, spot: number): number {
	switch (leg.kind) {
		case 'call':
			return Math.max(0, spot - (leg.strike ?? 0));
		case 'put':
			return Math.max(0, (leg.strike ?? 0) - spot);
		default:
			return spot;
	}
}

/** Profit or loss of the whole structure if the underlying settles at `spot` at expiry. */
export function pnlAtExpiry(legs: readonly PayoffLeg[], spot: number): number {
	let total = 0;
	for (const leg of legs) {
		total += leg.quantity * leg.multiplier * (unitValueAtExpiry(leg, spot) - leg.entryPrice);
	}
	return total;
}

/** Theoretical P&L before expiry, valuing option legs with Black-Scholes. */
export function theoreticalPnl(legs: readonly PayoffLeg[], spot: number, rate: number): number {
	let total = 0;
	for (const leg of legs) {
		let value: number;
		if ((leg.kind === 'call' || leg.kind === 'put') && leg.strike !== null) {
			value = blackScholes({
				right: leg.kind,
				spot,
				strike: leg.strike,
				years: leg.years ?? 0,
				rate,
				volatility: leg.volatility ?? 0
			}).price;
		} else {
			value = spot;
		}
		total += leg.quantity * leg.multiplier * (value - leg.entryPrice);
	}
	return total;
}

export interface PayoffProfile {
	/** `null` = unlimited */
	readonly maxProfit: number | null;
	/** Negative number, or `null` = unlimited */
	readonly maxLoss: number | null;
	readonly breakevens: readonly number[];
	/** Slope of P&L per $1 of underlying above the highest strike. */
	readonly upsideSlope: number;
}

/**
 * Exact payoff profile at expiry. The payoff is piecewise linear with kinks at the strikes,
 * so extremes occur at 0, at a strike, or at +∞ (decided by the upside slope).
 */
export function payoffProfile(legs: readonly PayoffLeg[]): PayoffProfile {
	const strikes = [...new Set(legs.filter((l) => l.strike !== null).map((l) => l.strike as number))].sort(
		(a, b) => a - b
	);
	const points = [0, ...strikes];
	const values = points.map((s) => pnlAtExpiry(legs, s));

	let upsideSlope = 0;
	for (const leg of legs) {
		// Calls and linear legs gain with the underlying above the top strike; puts are worthless.
		if (leg.kind !== 'put') upsideSlope += leg.quantity * leg.multiplier;
	}

	const finiteMax = Math.max(...values);
	const finiteMin = Math.min(...values);
	const eps = 1e-9;
	const maxProfit = upsideSlope > eps ? null : finiteMax;
	const maxLoss = upsideSlope < -eps ? null : finiteMin;

	const breakevens: number[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const x0 = points[i] as number;
		const x1 = points[i + 1] as number;
		const y0 = values[i] as number;
		const y1 = values[i + 1] as number;
		if (Math.abs(y0) < eps && i > 0) breakevens.push(x0);
		if ((y0 < -eps && y1 > eps) || (y0 > eps && y1 < -eps)) {
			breakevens.push(x0 + ((0 - y0) * (x1 - x0)) / (y1 - y0));
		}
	}
	const lastX = points[points.length - 1] as number;
	const lastY = values[values.length - 1] as number;
	if (Math.abs(lastY) < eps && points.length > 1) breakevens.push(lastX);
	if (Math.abs(upsideSlope) > eps && Math.sign(lastY) !== Math.sign(upsideSlope) && Math.abs(lastY) > eps) {
		breakevens.push(lastX - lastY / upsideSlope);
	}

	return {
		maxProfit,
		maxLoss: maxLoss === null ? null : Math.min(0, maxLoss),
		breakevens: [...new Set(breakevens.map((b) => Math.round(b * 10_000) / 10_000))].sort((a, b) => a - b),
		upsideSlope
	};
}

export interface PayoffPoint {
	readonly price: number;
	readonly expiry: number;
	readonly theoretical: number | null;
}

/** Sample points for charting the payoff curve across a price range. */
export function payoffCurve(
	legs: readonly PayoffLeg[],
	range: { readonly min: number; readonly max: number },
	options: { readonly samples?: number; readonly rate?: number; readonly includeTheoretical?: boolean } = {}
): PayoffPoint[] {
	const samples = Math.max(16, options.samples ?? 241);
	const min = Math.max(0, range.min);
	const max = Math.max(min + 0.01, range.max);
	const strikes = legs.filter((l) => l.strike !== null).map((l) => l.strike as number);
	const xs = new Set<number>(strikes.filter((k) => k >= min && k <= max));
	for (let i = 0; i < samples; i++) xs.add(min + ((max - min) * i) / (samples - 1));
	const canPrice =
		options.includeTheoretical === true &&
		legs.every((l) => (l.kind !== 'call' && l.kind !== 'put') || ((l.years ?? 0) > 0 && (l.volatility ?? 0) > 0));
	return [...xs]
		.sort((a, b) => a - b)
		.map((price) => ({
			price,
			expiry: pnlAtExpiry(legs, price),
			theoretical: canPrice ? theoreticalPnl(legs, price, options.rate ?? 0) : null
		}));
}

/** Sensible chart range centred on the strikes and the reference price. */
export function payoffRange(legs: readonly PayoffLeg[], reference: number | null): { min: number; max: number } {
	const anchors = legs.filter((l) => l.strike !== null).map((l) => l.strike as number);
	if (reference !== null && reference > 0) anchors.push(reference);
	if (anchors.length === 0) {
		const entry = legs[0]?.entryPrice ?? 100;
		anchors.push(entry);
	}
	const lo = Math.min(...anchors);
	const hi = Math.max(...anchors);
	const span = Math.max(hi - lo, hi * 0.08);
	return { min: Math.max(0, lo - span * 0.6), max: hi + span * 0.6 };
}
