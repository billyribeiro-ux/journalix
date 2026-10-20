import type { Execution, Leg, PriceLevel, Trade } from '../domain/schemas.ts';
import { newId } from '../util/id.ts';

export const ACCOUNT_ID = '0192f5a0-0000-7000-8000-000000000001';

export function leg(partial: Partial<Leg> & Pick<Leg, 'kind'>): Leg {
	return {
		id: newId(),
		underlying: 'SPY',
		strike: null,
		expiration: null,
		multiplier: partial.kind === 'stock' ? 1 : 100,
		...partial
	};
}

export function fill(
	l: Leg,
	side: 'buy' | 'sell',
	quantity: number,
	price: number,
	at: string,
	extra: Partial<Execution> = {}
): Execution {
	return {
		id: newId(Date.parse(at)),
		legId: l.id,
		side,
		kind: 'fill',
		quantity,
		price,
		fees: 0,
		executedAt: at,
		underlyingPrice: null,
		note: '',
		...extra
	};
}

export function level(kind: 'stop' | 'target', price: number, at: string): PriceLevel {
	return { id: newId(Date.parse(at)), kind, price, setAt: at, note: '' };
}

export function trade(legs: Leg[], executions: Execution[], extra: Partial<Trade> = {}): Trade {
	return {
		id: newId(),
		accountId: ACCOUNT_ID,
		underlying: legs[0]?.underlying ?? 'SPY',
		assetClass: legs.some((l) => l.kind === 'call' || l.kind === 'put') ? 'option' : 'stock',
		strategy: null,
		playbookId: null,
		tagIds: [],
		legs,
		executions,
		levels: [],
		plannedRisk: null,
		thesis: '',
		review: '',
		rating: null,
		confidence: null,
		mfe: null,
		mae: null,
		createdAt: '2026-10-01T13:00:00.000Z',
		updatedAt: '2026-10-01T13:00:00.000Z',
		...extra
	};
}

export const ENGINE = { timeZone: 'America/New_York', breakevenThreshold: 1 } as const;
