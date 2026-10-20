/**
 * European option pricing (Black-Scholes-Merton with continuous dividend yield),
 * analytic Greeks, and an implied-volatility solver.
 *
 * Conventions: T in years, r and q continuously compounded, σ annualised.
 * Theta is returned per calendar day, vega and rho per 1 percentage point.
 */

/**
 * Standard normal CDF, Hart (1968) double-precision algorithm as given by
 * G. West, "Better approximations to cumulative normal functions" (2005). |error| < 1e-14.
 */
export function normCdf(x: number): number {
	const z = Math.abs(x);
	let c: number;
	if (z > 37) {
		c = 0;
	} else {
		const e = Math.exp((-z * z) / 2);
		if (z < 7.07106781186547) {
			let n = 3.52624965998911e-2 * z + 0.700383064443688;
			n = n * z + 6.37396220353165;
			n = n * z + 33.912866078383;
			n = n * z + 112.079291497871;
			n = n * z + 221.213596169931;
			n = n * z + 220.206867912376;
			let d = 8.83883476483184e-2 * z + 1.75566716318264;
			d = d * z + 16.064177579207;
			d = d * z + 86.7807322029461;
			d = d * z + 296.564248779674;
			d = d * z + 637.333633378831;
			d = d * z + 793.826512519948;
			d = d * z + 440.413735824752;
			c = (e * n) / d;
		} else {
			let b = z + 0.65;
			b = z + 4 / b;
			b = z + 3 / b;
			b = z + 2 / b;
			b = z + 1 / b;
			c = e / b / 2.506628274631;
		}
	}
	return x > 0 ? 1 - c : c;
}

export function normPdf(x: number): number {
	return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type OptionRight = 'call' | 'put';

export interface PricingInput {
	readonly right: OptionRight;
	/** Underlying price */
	readonly spot: number;
	readonly strike: number;
	/** Years to expiry */
	readonly years: number;
	/** Risk-free rate */
	readonly rate: number;
	/** Dividend yield */
	readonly dividendYield?: number;
	/** Volatility */
	readonly volatility: number;
}

export interface Greeks {
	readonly price: number;
	readonly delta: number;
	readonly gamma: number;
	/** Per calendar day */
	readonly theta: number;
	/** Per 1 vol point */
	readonly vega: number;
	/** Per 1 rate point */
	readonly rho: number;
}

function intrinsic(right: OptionRight, spot: number, strike: number): number {
	return right === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

export function blackScholes(input: PricingInput): Greeks {
	const { right, spot: S, strike: K, years: T, rate: r, volatility: sigma } = input;
	const q = input.dividendYield ?? 0;
	if (!(S > 0) || !(K > 0)) throw new RangeError('Spot and strike must be positive');

	if (T <= 0 || sigma <= 0) {
		const value = intrinsic(right, S, K);
		const itm = right === 'call' ? S > K : S < K;
		return {
			price: value,
			delta: itm ? (right === 'call' ? 1 : -1) : 0,
			gamma: 0,
			theta: 0,
			vega: 0,
			rho: 0
		};
	}

	const sqrtT = Math.sqrt(T);
	const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
	const d2 = d1 - sigma * sqrtT;
	const dfR = Math.exp(-r * T);
	const dfQ = Math.exp(-q * T);
	const pdf = normPdf(d1);

	const gamma = (dfQ * pdf) / (S * sigma * sqrtT);
	const vega = (S * dfQ * pdf * sqrtT) / 100;

	if (right === 'call') {
		const Nd1 = normCdf(d1);
		const Nd2 = normCdf(d2);
		const price = S * dfQ * Nd1 - K * dfR * Nd2;
		const thetaYear = (-S * dfQ * pdf * sigma) / (2 * sqrtT) - r * K * dfR * Nd2 + q * S * dfQ * Nd1;
		return {
			price,
			delta: dfQ * Nd1,
			gamma,
			theta: thetaYear / 365,
			vega,
			rho: (K * T * dfR * Nd2) / 100
		};
	}

	const Nmd1 = normCdf(-d1);
	const Nmd2 = normCdf(-d2);
	const price = K * dfR * Nmd2 - S * dfQ * Nmd1;
	const thetaYear = (-S * dfQ * pdf * sigma) / (2 * sqrtT) + r * K * dfR * Nmd2 - q * S * dfQ * Nmd1;
	return {
		price,
		delta: -dfQ * Nmd1,
		gamma,
		theta: thetaYear / 365,
		vega,
		rho: (-K * T * dfR * Nmd2) / 100
	};
}

export interface ImpliedVolInput extends Omit<PricingInput, 'volatility'> {
	/** Observed option premium per share */
	readonly price: number;
}

const IV_MIN = 1e-4;
const IV_MAX = 5;

/**
 * Implied volatility by safeguarded Newton-Raphson (falls back to bisection when a Newton step
 * leaves the bracket). Returns `null` when the price is outside no-arbitrage bounds.
 */
export function impliedVolatility(input: ImpliedVolInput, tolerance = 1e-8): number | null {
	const { right, spot: S, strike: K, years: T, rate: r, price } = input;
	const q = input.dividendYield ?? 0;
	if (!(T > 0) || !(price > 0) || !(S > 0) || !(K > 0)) return null;

	const lower =
		right === 'call'
			? Math.max(0, S * Math.exp(-q * T) - K * Math.exp(-r * T))
			: Math.max(0, K * Math.exp(-r * T) - S * Math.exp(-q * T));
	const upper = right === 'call' ? S * Math.exp(-q * T) : K * Math.exp(-r * T);
	if (price < lower - 1e-10 || price >= upper) return null;

	const priceAt = (sigma: number): number =>
		blackScholes({ right, spot: S, strike: K, years: T, rate: r, dividendYield: q, volatility: sigma })
			.price;

	let lo = IV_MIN;
	let hi = IV_MAX;
	if (priceAt(lo) > price) return lo;
	if (priceAt(hi) < price) return null;

	// Brenner-Subrahmanyam seed.
	let sigma = Math.min(IV_MAX, Math.max(0.05, Math.sqrt((2 * Math.PI) / T) * (price / S)));
	for (let i = 0; i < 100; i++) {
		const g = blackScholes({
			right,
			spot: S,
			strike: K,
			years: T,
			rate: r,
			dividendYield: q,
			volatility: sigma
		});
		const diff = g.price - price;
		if (Math.abs(diff) < tolerance) return sigma;
		if (diff > 0) hi = sigma;
		else lo = sigma;
		const vegaRaw = g.vega * 100;
		let next = vegaRaw > 1e-12 ? sigma - diff / vegaRaw : Number.NaN;
		if (!(next > lo && next < hi)) next = (lo + hi) / 2;
		if (Math.abs(next - sigma) < 1e-12) return next;
		sigma = next;
	}
	return sigma;
}

/** Year fraction between two instants on an ACT/365 basis. */
export function yearsBetween(fromMs: number, toMs: number): number {
	return Math.max(0, (toMs - fromMs) / (365 * 86_400_000));
}

/**
 * Option expiry instant: 16:00 New York on the expiration date. Uses the zone's real offset,
 * so DST is handled without a timezone library.
 */
export function expiryInstant(expiration: string): number {
	const guess = Date.parse(`${expiration}T20:00:00Z`);
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		hourCycle: 'h23',
		hour: '2-digit'
	});
	const nyHour = Number(fmt.format(new Date(guess)));
	return guess + (16 - nyHour) * 3_600_000;
}
