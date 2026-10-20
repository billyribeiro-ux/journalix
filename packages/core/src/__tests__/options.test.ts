import { describe, expect, it } from 'vitest';
import { blackScholes, expiryInstant, impliedVolatility, normCdf } from '../options/black-scholes.ts';
import { describeContract, formatOcc, formatOccCompact, parseOcc } from '../options/occ.ts';
import { detectStrategy, type StructureLeg } from '../options/strategy.ts';
import { payoffProfile, pnlAtExpiry } from '../options/payoff.ts';

const E = '2026-11-20';
const L = (kind: StructureLeg['kind'], strike: number | null, quantity: number, expiration: string | null = E): StructureLeg => ({
	kind,
	strike,
	expiration: kind === 'stock' ? null : expiration,
	quantity,
	multiplier: kind === 'stock' ? 1 : 100
});

describe('normal CDF', () => {
	it('matches reference values', () => {
		expect(normCdf(0)).toBeCloseTo(0.5, 14);
		expect(normCdf(1.96)).toBeCloseTo(0.9750021048517795, 12);
		expect(normCdf(-1)).toBeCloseTo(0.15865525393145707, 12);
		expect(normCdf(8)).toBeCloseTo(1, 14);
	});
});

describe('Black-Scholes', () => {
	// Hull, Options Futures and Other Derivatives: S=K=100, T=1, r=5%, σ=20%.
	const base = { spot: 100, strike: 100, years: 1, rate: 0.05, volatility: 0.2 } as const;

	it('prices calls and puts and satisfies put-call parity', () => {
		const c = blackScholes({ ...base, right: 'call' });
		const p = blackScholes({ ...base, right: 'put' });
		expect(c.price).toBeCloseTo(10.450583572185565, 9);
		expect(p.price).toBeCloseTo(5.573526022256971, 9);
		expect(c.price - p.price).toBeCloseTo(100 - 100 * Math.exp(-0.05), 9);
		expect(c.delta).toBeCloseTo(0.6368306511756191, 9);
		expect(p.delta).toBeCloseTo(c.delta - 1, 9);
		expect(c.gamma).toBeCloseTo(p.gamma, 12);
	});

	it('recovers volatility from price', () => {
		for (const right of ['call', 'put'] as const) {
			for (const sigma of [0.08, 0.2, 0.65, 1.4]) {
				const price = blackScholes({ ...base, right, volatility: sigma, strike: 110 }).price;
				expect(impliedVolatility({ ...base, right, strike: 110, price })).toBeCloseTo(sigma, 6);
			}
		}
	});

	it('rejects prices below intrinsic', () => {
		expect(impliedVolatility({ ...base, right: 'call', strike: 80, price: 10 })).toBeNull();
	});

	it('expires at 16:00 New York across DST', () => {
		expect(new Date(expiryInstant('2026-07-17')).toISOString()).toBe('2026-07-17T20:00:00.000Z');
		expect(new Date(expiryInstant('2026-12-18')).toISOString()).toBe('2026-12-18T21:00:00.000Z');
	});
});

describe('OCC symbology', () => {
	const c = { underlying: 'SPY', expiration: '2026-12-18', kind: 'call', strike: 450 } as const;
	it('formats and parses', () => {
		expect(formatOcc(c)).toBe('SPY   261218C00450000');
		expect(formatOccCompact(c)).toBe('SPY261218C00450000');
		expect(parseOcc('O:SPY261218C00450000')).toEqual(c);
		expect(parseOcc('SPY   261218P00450500')?.strike).toBe(450.5);
		expect(parseOcc('nope')).toBeNull();
		expect(describeContract(c)).toBe('SPY 18 Dec 26 450C');
	});
});

describe('strategy detection', () => {
	const cases: [string, StructureLeg[]][] = [
		['shares_long', [L('stock', null, 100)]],
		['shares_short', [L('stock', null, -100)]],
		['long_call', [L('call', 100, 1)]],
		['short_put', [L('put', 100, -2)]],
		['covered_call', [L('stock', null, 100), L('call', 110, -1)]],
		['protective_put', [L('stock', null, 200), L('put', 90, 2)]],
		['collar', [L('stock', null, 100), L('put', 90, 1), L('call', 110, -1)]],
		['bull_call_spread', [L('call', 100, 1), L('call', 105, -1)]],
		['bear_call_spread', [L('call', 100, -1), L('call', 105, 1)]],
		['bull_put_spread', [L('put', 95, 1), L('put', 100, -1)]],
		['bear_put_spread', [L('put', 95, -1), L('put', 100, 1)]],
		['ratio_spread', [L('call', 100, 1), L('call', 105, -2)]],
		['long_straddle', [L('call', 100, 1), L('put', 100, 1)]],
		['short_strangle', [L('call', 110, -1), L('put', 90, -1)]],
		['iron_condor', [L('put', 85, 1), L('put', 90, -1), L('call', 110, -1), L('call', 115, 1)]],
		['reverse_iron_condor', [L('put', 85, -1), L('put', 90, 1), L('call', 110, 1), L('call', 115, -1)]],
		['iron_butterfly', [L('put', 90, 1), L('put', 100, -1), L('call', 100, -1), L('call', 110, 1)]],
		['long_call_butterfly', [L('call', 95, 1), L('call', 100, -2), L('call', 105, 1)]],
		['short_put_butterfly', [L('put', 95, -1), L('put', 100, 2), L('put', 105, -1)]],
		['call_calendar', [L('call', 100, -1, '2026-11-20'), L('call', 100, 1, '2026-12-18')]],
		['put_diagonal', [L('put', 100, -1, '2026-11-20'), L('put', 95, 1, '2026-12-18')]],
		['futures_long', [{ kind: 'future', strike: null, expiration: null, quantity: 2, multiplier: 50 }]],
		['custom', [L('call', 100, 1), L('put', 100, 1), L('call', 120, -1)]]
	];
	it.each(cases)('detects %s', (expected, legs) => {
		expect(detectStrategy(legs)).toBe(expected);
	});
});

describe('payoff profile', () => {
	it('bounds a debit call spread', () => {
		const legs = [
			{ kind: 'call' as const, strike: 100, quantity: 1, multiplier: 100, entryPrice: 3 },
			{ kind: 'call' as const, strike: 105, quantity: -1, multiplier: 100, entryPrice: 1 }
		];
		const p = payoffProfile(legs);
		expect(p.maxLoss).toBeCloseTo(-200, 10);
		expect(p.maxProfit).toBeCloseTo(300, 10);
		expect(p.breakevens).toEqual([102]);
	});

	it('reports unlimited upside for a long call and unlimited loss for a short call', () => {
		const long = payoffProfile([{ kind: 'call', strike: 100, quantity: 1, multiplier: 100, entryPrice: 2 }]);
		expect(long.maxProfit).toBeNull();
		expect(long.maxLoss).toBeCloseTo(-200, 10);
		expect(long.breakevens).toEqual([102]);
		const short = payoffProfile([{ kind: 'call', strike: 100, quantity: -1, multiplier: 100, entryPrice: 2 }]);
		expect(short.maxLoss).toBeNull();
		expect(short.maxProfit).toBeCloseTo(200, 10);
	});

	it('finds both breakevens of an iron condor', () => {
		const legs = [
			{ kind: 'put' as const, strike: 85, quantity: 1, multiplier: 100, entryPrice: 0.5 },
			{ kind: 'put' as const, strike: 90, quantity: -1, multiplier: 100, entryPrice: 1.5 },
			{ kind: 'call' as const, strike: 110, quantity: -1, multiplier: 100, entryPrice: 1.5 },
			{ kind: 'call' as const, strike: 115, quantity: 1, multiplier: 100, entryPrice: 0.5 }
		];
		const p = payoffProfile(legs);
		expect(p.maxProfit).toBeCloseTo(200, 10);
		expect(p.maxLoss).toBeCloseTo(-300, 10);
		expect(p.breakevens).toEqual([88, 112]);
		expect(pnlAtExpiry(legs, 100)).toBeCloseTo(200, 10);
	});

	it('handles a covered call (stock leg)', () => {
		const p = payoffProfile([
			{ kind: 'stock', strike: null, quantity: 100, multiplier: 1, entryPrice: 100 },
			{ kind: 'call', strike: 105, quantity: -1, multiplier: 100, entryPrice: 2 }
		]);
		expect(p.maxProfit).toBeCloseTo(700, 10);
		expect(p.maxLoss).toBeCloseTo(-9800, 10);
		expect(p.breakevens).toEqual([98]);
	});
});
