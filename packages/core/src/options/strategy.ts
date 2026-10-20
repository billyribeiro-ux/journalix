import type { LegKind, StrategyKind } from '../domain/schemas.ts';

/** A leg's opening structure: signed size (+ long, − short) in contracts or shares. */
export interface StructureLeg {
	readonly kind: LegKind;
	readonly strike: number | null;
	readonly expiration: string | null;
	readonly quantity: number;
	readonly multiplier: number;
}

export type StrategyBias = 'bullish' | 'bearish' | 'neutral' | 'volatility' | 'mixed';

export interface StrategyInfo {
	readonly label: string;
	readonly short: string;
	readonly bias: StrategyBias;
	/** Whether loss is bounded by the structure itself (before stops). */
	readonly definedRisk: boolean;
	readonly family:
		| 'shares'
		| 'single'
		| 'vertical'
		| 'volatility'
		| 'condor'
		| 'butterfly'
		| 'time'
		| 'stock-hedge'
		| 'futures'
		| 'other';
}

export const STRATEGIES: Readonly<Record<StrategyKind, StrategyInfo>> = {
	shares_long: {
		label: 'Long shares',
		short: 'Long',
		bias: 'bullish',
		definedRisk: false,
		family: 'shares'
	},
	shares_short: {
		label: 'Short shares',
		short: 'Short',
		bias: 'bearish',
		definedRisk: false,
		family: 'shares'
	},
	long_call: {
		label: 'Long call',
		short: 'LC',
		bias: 'bullish',
		definedRisk: true,
		family: 'single'
	},
	short_call: {
		label: 'Short call',
		short: 'SC',
		bias: 'bearish',
		definedRisk: false,
		family: 'single'
	},
	long_put: {
		label: 'Long put',
		short: 'LP',
		bias: 'bearish',
		definedRisk: true,
		family: 'single'
	},
	short_put: {
		label: 'Short put',
		short: 'SP',
		bias: 'bullish',
		definedRisk: false,
		family: 'single'
	},
	covered_call: {
		label: 'Covered call',
		short: 'CC',
		bias: 'bullish',
		definedRisk: false,
		family: 'stock-hedge'
	},
	protective_put: {
		label: 'Protective put',
		short: 'PP',
		bias: 'bullish',
		definedRisk: true,
		family: 'stock-hedge'
	},
	collar: {
		label: 'Collar',
		short: 'Collar',
		bias: 'bullish',
		definedRisk: true,
		family: 'stock-hedge'
	},
	bull_call_spread: {
		label: 'Bull call spread',
		short: 'BCS',
		bias: 'bullish',
		definedRisk: true,
		family: 'vertical'
	},
	bear_call_spread: {
		label: 'Bear call spread',
		short: 'BeCS',
		bias: 'bearish',
		definedRisk: true,
		family: 'vertical'
	},
	bull_put_spread: {
		label: 'Bull put spread',
		short: 'BPS',
		bias: 'bullish',
		definedRisk: true,
		family: 'vertical'
	},
	bear_put_spread: {
		label: 'Bear put spread',
		short: 'BePS',
		bias: 'bearish',
		definedRisk: true,
		family: 'vertical'
	},
	long_straddle: {
		label: 'Long straddle',
		short: 'L Strad',
		bias: 'volatility',
		definedRisk: true,
		family: 'volatility'
	},
	short_straddle: {
		label: 'Short straddle',
		short: 'S Strad',
		bias: 'neutral',
		definedRisk: false,
		family: 'volatility'
	},
	long_strangle: {
		label: 'Long strangle',
		short: 'L Strang',
		bias: 'volatility',
		definedRisk: true,
		family: 'volatility'
	},
	short_strangle: {
		label: 'Short strangle',
		short: 'S Strang',
		bias: 'neutral',
		definedRisk: false,
		family: 'volatility'
	},
	iron_condor: {
		label: 'Iron condor',
		short: 'IC',
		bias: 'neutral',
		definedRisk: true,
		family: 'condor'
	},
	reverse_iron_condor: {
		label: 'Reverse iron condor',
		short: 'RIC',
		bias: 'volatility',
		definedRisk: true,
		family: 'condor'
	},
	iron_butterfly: {
		label: 'Iron butterfly',
		short: 'IB',
		bias: 'neutral',
		definedRisk: true,
		family: 'butterfly'
	},
	reverse_iron_butterfly: {
		label: 'Reverse iron butterfly',
		short: 'RIB',
		bias: 'volatility',
		definedRisk: true,
		family: 'butterfly'
	},
	long_call_butterfly: {
		label: 'Long call butterfly',
		short: 'LCB',
		bias: 'neutral',
		definedRisk: true,
		family: 'butterfly'
	},
	short_call_butterfly: {
		label: 'Short call butterfly',
		short: 'SCB',
		bias: 'volatility',
		definedRisk: true,
		family: 'butterfly'
	},
	long_put_butterfly: {
		label: 'Long put butterfly',
		short: 'LPB',
		bias: 'neutral',
		definedRisk: true,
		family: 'butterfly'
	},
	short_put_butterfly: {
		label: 'Short put butterfly',
		short: 'SPB',
		bias: 'volatility',
		definedRisk: true,
		family: 'butterfly'
	},
	call_calendar: {
		label: 'Call calendar',
		short: 'C Cal',
		bias: 'neutral',
		definedRisk: true,
		family: 'time'
	},
	put_calendar: {
		label: 'Put calendar',
		short: 'P Cal',
		bias: 'neutral',
		definedRisk: true,
		family: 'time'
	},
	call_diagonal: {
		label: 'Call diagonal',
		short: 'C Diag',
		bias: 'bullish',
		definedRisk: true,
		family: 'time'
	},
	put_diagonal: {
		label: 'Put diagonal',
		short: 'P Diag',
		bias: 'bearish',
		definedRisk: true,
		family: 'time'
	},
	ratio_spread: {
		label: 'Ratio spread',
		short: 'Ratio',
		bias: 'mixed',
		definedRisk: false,
		family: 'other'
	},
	futures_long: {
		label: 'Long futures',
		short: 'Long',
		bias: 'bullish',
		definedRisk: false,
		family: 'futures'
	},
	futures_short: {
		label: 'Short futures',
		short: 'Short',
		bias: 'bearish',
		definedRisk: false,
		family: 'futures'
	},
	custom: { label: 'Custom', short: 'Custom', bias: 'mixed', definedRisk: false, family: 'other' }
};

export const STRATEGY_KINDS = Object.keys(STRATEGIES) as StrategyKind[];

function gcd(a: number, b: number): number {
	let x = Math.abs(Math.round(a));
	let y = Math.abs(Math.round(b));
	while (y) [x, y] = [y, x % y];
	return x || 1;
}

/** Reduces quantities to their smallest integer ratio, e.g. [2, −4, 2] → [1, −2, 1]. */
function ratio(qs: readonly number[]): number[] {
	const g = qs.reduce((acc, q) => gcd(acc, q), 0) || 1;
	return qs.map((q) => Math.round(q / g));
}

const isOption = (l: StructureLeg): boolean => l.kind === 'call' || l.kind === 'put';

/**
 * Classifies an opening structure into a named strategy. Matching is exact: legs must line up
 * by type, expiry, strike order and ratio, otherwise the result is `custom` (or `ratio_spread`).
 */
export function detectStrategy(input: readonly StructureLeg[]): StrategyKind {
	const legs = input.filter((l) => l.quantity !== 0);
	if (legs.length === 0) return 'custom';

	const options = legs.filter(isOption);
	const others = legs.filter((l) => !isOption(l));

	if (options.length === 0) {
		if (others.length !== 1) return 'custom';
		const only = others[0];
		if (!only) return 'custom';
		if (only.kind === 'future') return only.quantity > 0 ? 'futures_long' : 'futures_short';
		return only.quantity > 0 ? 'shares_long' : 'shares_short';
	}

	if (others.length > 0) {
		if (others.length !== 1) return 'custom';
		const stock = others[0];
		if (!stock || stock.kind !== 'stock' || stock.quantity <= 0) return 'custom';
		const shares = stock.quantity * stock.multiplier;
		const calls = options.filter((o) => o.kind === 'call');
		const puts = options.filter((o) => o.kind === 'put');
		const covers = (o: StructureLeg): boolean =>
			Math.abs(o.quantity * o.multiplier) <= shares + 1e-9;
		if (options.length === 1) {
			const o = options[0];
			if (!o || !covers(o)) return 'custom';
			if (o.kind === 'call' && o.quantity < 0) return 'covered_call';
			if (o.kind === 'put' && o.quantity > 0) return 'protective_put';
			return 'custom';
		}
		if (options.length === 2 && calls.length === 1 && puts.length === 1) {
			const c = calls[0];
			const p = puts[0];
			if (c && p && c.quantity < 0 && p.quantity > 0 && covers(c) && covers(p)) return 'collar';
		}
		return 'custom';
	}

	const sorted = [...options].sort(
		(a, b) =>
			(a.expiration ?? '').localeCompare(b.expiration ?? '') || (a.strike ?? 0) - (b.strike ?? 0)
	);
	const expirations = new Set(sorted.map((o) => o.expiration));
	const calls = sorted.filter((o) => o.kind === 'call');
	const puts = sorted.filter((o) => o.kind === 'put');

	if (sorted.length === 1) {
		const o = sorted[0];
		if (!o) return 'custom';
		if (o.kind === 'call') return o.quantity > 0 ? 'long_call' : 'short_call';
		return o.quantity > 0 ? 'long_put' : 'short_put';
	}

	if (sorted.length === 2) {
		const [a, b] = sorted as [StructureLeg, StructureLeg];
		const [ra, rb] = ratio([a.quantity, b.quantity]) as [number, number];
		const balanced = Math.abs(ra) === Math.abs(rb);

		if (a.kind === b.kind && expirations.size === 2) {
			if (!balanced || Math.sign(ra) === Math.sign(rb)) return 'custom';
			const near = a;
			const far = b;
			// Time spreads: sell the near month, buy the far month.
			if (near.quantity > 0 || far.quantity < 0) return 'custom';
			const kind = a.kind;
			if (near.strike === far.strike) return kind === 'call' ? 'call_calendar' : 'put_calendar';
			return kind === 'call' ? 'call_diagonal' : 'put_diagonal';
		}

		if (expirations.size !== 1) return 'custom';

		if (a.kind === b.kind) {
			if (Math.sign(ra) === Math.sign(rb)) return 'custom';
			if (!balanced) return 'ratio_spread';
			// a has the lower strike.
			if (a.strike === b.strike) return 'custom';
			if (a.kind === 'call') return a.quantity > 0 ? 'bull_call_spread' : 'bear_call_spread';
			return a.quantity > 0 ? 'bull_put_spread' : 'bear_put_spread';
		}

		// One call and one put, same expiry.
		const call = a.kind === 'call' ? a : b;
		const put = a.kind === 'put' ? a : b;
		if (!balanced || Math.sign(call.quantity) !== Math.sign(put.quantity)) return 'custom';
		const long = call.quantity > 0;
		if (call.strike === put.strike) return long ? 'long_straddle' : 'short_straddle';
		if ((put.strike ?? 0) < (call.strike ?? 0)) return long ? 'long_strangle' : 'short_strangle';
		return 'custom';
	}

	if (expirations.size !== 1) return 'custom';

	if (sorted.length === 3 && (calls.length === 3 || puts.length === 3)) {
		const r = ratio(sorted.map((o) => o.quantity));
		const strikes = sorted.map((o) => o.strike ?? 0);
		const [k1, k2, k3] = strikes as [number, number, number];
		const symmetric = Math.abs(k2 - k1 - (k3 - k2)) < 1e-9 && k1 < k2;
		if (!symmetric) return 'custom';
		const kind = sorted[0]?.kind;
		if (r[0] === 1 && r[1] === -2 && r[2] === 1)
			return kind === 'call' ? 'long_call_butterfly' : 'long_put_butterfly';
		if (r[0] === -1 && r[1] === 2 && r[2] === -1)
			return kind === 'call' ? 'short_call_butterfly' : 'short_put_butterfly';
		return 'custom';
	}

	if (sorted.length === 4 && calls.length === 2 && puts.length === 2) {
		const [p1, p2] = puts as [StructureLeg, StructureLeg];
		const [c1, c2] = calls as [StructureLeg, StructureLeg];
		const r = ratio([p1.quantity, p2.quantity, c1.quantity, c2.quantity]);
		const pk1 = p1.strike ?? 0;
		const pk2 = p2.strike ?? 0;
		const ck1 = c1.strike ?? 0;
		const ck2 = c2.strike ?? 0;
		if (!(pk1 < pk2 && ck1 < ck2 && pk2 <= ck1)) return 'custom';
		const sameBody = pk2 === ck1;
		if (r[0] === 1 && r[1] === -1 && r[2] === -1 && r[3] === 1)
			return sameBody ? 'iron_butterfly' : 'iron_condor';
		if (r[0] === -1 && r[1] === 1 && r[2] === 1 && r[3] === -1)
			return sameBody ? 'reverse_iron_butterfly' : 'reverse_iron_condor';
		return 'custom';
	}

	return 'custom';
}
