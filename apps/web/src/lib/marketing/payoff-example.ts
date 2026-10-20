import { blackScholes, payoffProfile, type PayoffLeg } from '@journalix/core';

/**
 * A worked iron condor used for the illustration on the home and options pages. Entry
 * premiums are Black-Scholes prices at the stated inputs, so the "today" curve starts at zero
 * at the entry price exactly as it does for a real trade logged at those fills.
 */
const SPOT = 672;
const YEARS = 35 / 365;
const VOL = 0.17;
const RATE = 0.04;

function leg(kind: 'call' | 'put', strike: number, quantity: number): PayoffLeg {
	const premium = blackScholes({
		right: kind,
		spot: SPOT,
		strike,
		years: YEARS,
		rate: RATE,
		volatility: VOL
	}).price;
	return {
		kind,
		strike,
		quantity,
		multiplier: 100,
		entryPrice: Math.round(premium * 100) / 100,
		// Value the "today" curve a week after entry.
		years: YEARS - 7 / 365,
		volatility: VOL
	};
}

export const IRON_CONDOR = {
	symbol: 'SPY',
	spot: SPOT,
	rate: RATE,
	dte: 35,
	legs: [leg('put', 630, 1), leg('put', 640, -1), leg('call', 705, -1), leg('call', 715, 1)],
	range: { min: 615, max: 730 }
} as const;

export const IRON_CONDOR_PROFILE = payoffProfile(IRON_CONDOR.legs);

/** Net credit per share received for the condor. */
export const IRON_CONDOR_CREDIT =
	-IRON_CONDOR.legs.reduce((sum, l) => sum + l.quantity * l.entryPrice, 0) || 0;
