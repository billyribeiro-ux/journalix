/**
 * Greeks at entry and an estimated P&L attribution (delta / gamma / theta / vega) for option
 * trades. Requires the underlying price to have been recorded on the opening and closing fills;
 * implied volatility is solved from each fill's premium.
 */
import type { TradeView } from '../engine/position.ts';
import type { Execution, Leg } from '../domain/schemas.ts';
import { blackScholes, expiryInstant, impliedVolatility, yearsBetween } from './black-scholes.ts';

export interface LegGreeks {
	readonly legId: string;
	readonly iv: number;
	readonly delta: number;
	readonly gamma: number;
	readonly theta: number;
	readonly vega: number;
}

export interface PositionGreeks {
	/** Share-equivalent delta of the whole position. */
	readonly delta: number;
	/** Delta change per $1 move, share-equivalent. */
	readonly gamma: number;
	/** Dollars per calendar day. */
	readonly theta: number;
	/** Dollars per 1 vol point. */
	readonly vega: number;
	readonly legs: readonly LegGreeks[];
	/** Quantity-weighted average IV of the option legs. */
	readonly averageIv: number;
}

function isOption(
	leg: Leg
): leg is Leg & { kind: 'call' | 'put'; strike: number; expiration: string } {
	return (
		(leg.kind === 'call' || leg.kind === 'put') && leg.strike !== null && leg.expiration !== null
	);
}

function legGreeksAt(leg: Leg, fill: Execution, rate: number): LegGreeks | null {
	if (!isOption(leg) || fill.underlyingPrice === null) return null;
	const years = yearsBetween(Date.parse(fill.executedAt), expiryInstant(leg.expiration));
	if (years <= 0) return null;
	const iv = impliedVolatility({
		right: leg.kind,
		spot: fill.underlyingPrice,
		strike: leg.strike,
		years,
		rate,
		price: fill.price
	});
	if (iv === null) return null;
	const g = blackScholes({
		right: leg.kind,
		spot: fill.underlyingPrice,
		strike: leg.strike,
		years,
		rate,
		volatility: iv
	});
	// Theta as the value lost over the next calendar day (or until expiry, if sooner). The
	// analytic rate ÷ 365 overstates decay near expiry, where it can exceed the option's value.
	const step = Math.min(1 / 365, years);
	const later =
		years - step > 0
			? blackScholes({
					right: leg.kind,
					spot: fill.underlyingPrice,
					strike: leg.strike,
					years: years - step,
					rate,
					volatility: iv
				}).price
			: leg.kind === 'call'
				? Math.max(0, fill.underlyingPrice - leg.strike)
				: Math.max(0, leg.strike - fill.underlyingPrice);
	const theta = years > 1 / 365 ? g.theta : later - g.price;
	return { legId: leg.id, iv, delta: g.delta, gamma: g.gamma, theta, vega: g.vega };
}

/** Position Greeks from the first opening fill of every option leg. */
export function entryGreeks(view: TradeView, rate: number): PositionGreeks | null {
	const legs: LegGreeks[] = [];
	let delta = 0;
	let gamma = 0;
	let theta = 0;
	let vega = 0;
	let ivWeighted = 0;
	let weight = 0;
	for (const state of view.metrics.legs) {
		const opening = state.executions[0];
		if (!opening || state.peakQuantity === 0) continue;
		const size = state.peakQuantity * state.leg.multiplier;
		if (!isOption(state.leg)) {
			delta += size;
			continue;
		}
		const g = legGreeksAt(state.leg, opening, rate);
		if (!g) return null;
		legs.push(g);
		delta += g.delta * size;
		gamma += g.gamma * size;
		theta += g.theta * size;
		vega += g.vega * size;
		ivWeighted += g.iv * Math.abs(state.peakQuantity);
		weight += Math.abs(state.peakQuantity);
	}
	if (legs.length === 0) return null;
	return { delta, gamma, theta, vega, legs, averageIv: weight ? ivWeighted / weight : 0 };
}

export interface PnlAttribution {
	readonly delta: number;
	readonly gamma: number;
	readonly theta: number;
	readonly vega: number;
	/** Actual gross P&L minus the Greek estimate (higher-order terms, path, fill quality). */
	readonly residual: number;
	readonly actual: number;
	readonly days: number;
	readonly underlyingMove: number;
	readonly ivChange: number;
}

/**
 * First-order Taylor attribution using entry Greeks:
 * ΔP ≈ Δ·dS + ½Γ·dS² + Θ·dt + ν·dσ. An estimate — it explains *why* a trade made or lost
 * money, not an exact decomposition.
 */
export function attributePnl(view: TradeView, rate: number): PnlAttribution | null {
	const { metrics } = view;
	if (metrics.status !== 'closed') return null;
	const greeks = entryGreeks(view, rate);
	if (!greeks) return null;

	let delta = 0;
	let gamma = 0;
	let theta = 0;
	let vega = 0;
	let days = 0;
	let move = 0;
	let ivChange = 0;
	let ivWeight = 0;

	for (const state of metrics.legs) {
		const open = state.executions[0];
		const close = state.executions[state.executions.length - 1];
		if (!open || !close || open === close || state.peakQuantity === 0) continue;
		if (open.underlyingPrice === null || close.underlyingPrice === null) return null;
		const size = state.peakQuantity * state.leg.multiplier;
		const dS = close.underlyingPrice - open.underlyingPrice;
		const dtDays = (Date.parse(close.executedAt) - Date.parse(open.executedAt)) / 86_400_000;
		days = Math.max(days, dtDays);
		move = dS;
		if (!isOption(state.leg)) {
			delta += size * dS;
			continue;
		}
		const entry = greeks.legs.find((g) => g.legId === state.leg.id);
		if (!entry) return null;
		let exitIv = entry.iv;
		if (close.kind === 'fill' && close.price > 0) {
			const solved = legGreeksAt(state.leg, close, rate);
			if (solved) exitIv = solved.iv;
		}
		delta += entry.delta * size * dS;
		gamma += 0.5 * entry.gamma * size * dS * dS;
		theta += entry.theta * size * dtDays;
		vega += entry.vega * size * (exitIv - entry.iv) * 100;
		ivChange += (exitIv - entry.iv) * Math.abs(state.peakQuantity);
		ivWeight += Math.abs(state.peakQuantity);
	}

	const actual = metrics.grossPnl;
	return {
		delta,
		gamma,
		theta,
		vega,
		residual: actual - (delta + gamma + theta + vega),
		actual,
		days,
		underlyingMove: move,
		ivChange: ivWeight ? ivChange / ivWeight : 0
	};
}

/** Share of the maximum credit kept, for credit trades (e.g. 0.5 = closed at 50% of max profit). */
export function premiumCaptured(view: TradeView): number | null {
	const { metrics } = view;
	if (metrics.status !== 'closed' || metrics.entryType !== 'credit' || metrics.openingCashflow <= 0)
		return null;
	return metrics.grossPnl / metrics.openingCashflow;
}
