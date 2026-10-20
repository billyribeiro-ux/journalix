import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { computeLegState, computeTradeMetrics } from '../engine/position.ts';
import { TradeSchema } from '../domain/schemas.ts';
import { ENGINE, fill, leg, level, trade } from './fixtures.ts';

describe('average-cost leg state', () => {
	it('computes realized P&L across adds and partial exits', () => {
		const s = leg({ kind: 'stock' });
		const state = computeLegState(s, [
			fill(s, 'buy', 100, 10, '2026-10-01T14:00:00.000Z'),
			fill(s, 'buy', 100, 12, '2026-10-01T14:10:00.000Z'),
			fill(s, 'sell', 50, 14, '2026-10-01T14:20:00.000Z'),
			fill(s, 'sell', 150, 13, '2026-10-01T14:30:00.000Z')
		]);
		// Average 11 → (14−11)·50 + (13−11)·150 = 150 + 300
		expect(state.realizedPnl).toBeCloseTo(450, 10);
		expect(state.netQuantity).toBe(0);
		expect(state.peakQuantity).toBe(200);
		expect(state.averageOpenPrice).toBeCloseTo(11, 10);
		expect(state.averageClosePrice).toBeCloseTo(13.25, 10);
	});

	it('handles short positions and flips through zero', () => {
		const s = leg({ kind: 'stock' });
		const state = computeLegState(s, [
			fill(s, 'sell', 100, 50, '2026-10-01T14:00:00.000Z'),
			fill(s, 'buy', 150, 48, '2026-10-01T14:10:00.000Z'),
			fill(s, 'sell', 50, 49, '2026-10-01T14:20:00.000Z')
		]);
		// Short 100 @50 covered @48 = +200; flip long 50 @48, sold @49 = +50.
		expect(state.realizedPnl).toBeCloseTo(250, 10);
		expect(state.netQuantity).toBe(0);
		expect(state.peakQuantity).toBe(-100);
	});

	it('applies the contract multiplier for options', () => {
		const c = leg({ kind: 'call', strike: 600, expiration: '2026-11-20' });
		const state = computeLegState(c, [
			fill(c, 'buy', 2, 3.5, '2026-10-01T14:00:00.000Z'),
			fill(c, 'sell', 2, 5.25, '2026-10-02T14:00:00.000Z')
		]);
		expect(state.realizedPnl).toBeCloseTo(350, 10);
		expect(state.openingCashflow).toBeCloseTo(-700, 10);
	});
});

describe('trade metrics', () => {
	it('derives status, direction, fees, net P&L and R from a stop', () => {
		const s = leg({ kind: 'stock', underlying: 'AAPL' });
		const t = trade(
			[s],
			[
				fill(s, 'buy', 100, 200, '2026-10-01T14:00:00.000Z', { fees: 1 }),
				fill(s, 'sell', 100, 206, '2026-10-01T15:00:00.000Z', { fees: 1 })
			],
			{ underlying: 'AAPL', levels: [level('stop', 197, '2026-10-01T14:00:00.000Z'), level('target', 209, '2026-10-01T14:00:00.000Z')] }
		);
		expect(v.safeParse(TradeSchema, t).success).toBe(true);
		const m = computeTradeMetrics(t, ENGINE);
		expect(m.status).toBe('closed');
		expect(m.direction).toBe('long');
		expect(m.strategy).toBe('shares_long');
		expect(m.grossPnl).toBeCloseTo(600, 10);
		expect(m.netPnl).toBeCloseTo(598, 10);
		expect(m.initialRisk).toBeCloseTo(300, 10);
		expect(m.riskSource).toBe('stop');
		expect(m.rMultiple).toBeCloseTo(598 / 300, 10);
		expect(m.plannedRewardRisk).toBeCloseTo(3, 10);
		expect(m.outcome).toBe('win');
		expect(m.holdMs).toBe(3_600_000);
	});

	it('uses planned risk over everything else', () => {
		const s = leg({ kind: 'stock' });
		const t = trade(
			[s],
			[fill(s, 'buy', 10, 100, '2026-10-01T14:00:00.000Z'), fill(s, 'sell', 10, 99, '2026-10-01T14:05:00.000Z')],
			{ plannedRisk: 50, levels: [level('stop', 95, '2026-10-01T14:00:00.000Z')] }
		);
		const m = computeTradeMetrics(t, ENGINE);
		expect(m.riskSource).toBe('planned');
		expect(m.rMultiple).toBeCloseTo(-0.2, 10);
	});

	it('treats a credit vertical as short with structure risk', () => {
		const shortPut = leg({ kind: 'put', strike: 650, expiration: '2026-11-20' });
		const longPut = leg({ kind: 'put', strike: 645, expiration: '2026-11-20' });
		const t = trade(
			[longPut, shortPut],
			[
				fill(longPut, 'buy', 1, 1.0, '2026-10-01T14:00:00.000Z'),
				fill(shortPut, 'sell', 1, 2.5, '2026-10-01T14:00:00.000Z'),
				fill(longPut, 'sell', 1, 0.3, '2026-10-10T14:00:00.000Z'),
				fill(shortPut, 'buy', 1, 0.8, '2026-10-10T14:00:00.000Z')
			]
		);
		const m = computeTradeMetrics(t, ENGINE);
		expect(m.strategy).toBe('bull_put_spread');
		expect(m.entryType).toBe('credit');
		expect(m.direction).toBe('short');
		expect(m.openingCashflow).toBeCloseTo(150, 10);
		expect(m.maxProfit).toBeCloseTo(150, 10);
		expect(m.maxLoss).toBeCloseTo(-350, 10);
		expect(m.breakevens).toEqual([648.5]);
		expect(m.initialRisk).toBeCloseTo(350, 10);
		// −0.7·100 + 1.7·100 = 100
		expect(m.grossPnl).toBeCloseTo(100, 10);
		expect(m.dteAtEntry).toBe(50);
	});

	it('marks a trade open until every leg is flat, and counts adds/partials', () => {
		const s = leg({ kind: 'stock' });
		const t = trade(
			[s],
			[
				fill(s, 'buy', 100, 10, '2026-10-01T14:00:00.000Z'),
				fill(s, 'buy', 100, 11, '2026-10-01T14:10:00.000Z'),
				fill(s, 'sell', 50, 12, '2026-10-01T14:20:00.000Z')
			]
		);
		const m = computeTradeMetrics(t, ENGINE);
		expect(m.status).toBe('open');
		expect(m.outcome).toBe('open');
		expect(m.adds).toBe(1);
		expect(m.partialExits).toBe(1);
		expect(m.rMultiple).toBeNull();
	});

	it('detects expiration and planned status', () => {
		const p = leg({ kind: 'put', strike: 600, expiration: '2026-10-16' });
		const expired = trade(
			[p],
			[
				fill(p, 'sell', 1, 1.2, '2026-10-01T14:00:00.000Z'),
				fill(p, 'buy', 1, 0, '2026-10-16T20:00:00.000Z', { kind: 'expiration' })
			]
		);
		const m = computeTradeMetrics(expired, ENGINE);
		expect(m.expiredWorthless).toBe(true);
		expect(m.netPnl).toBeCloseTo(120, 10);
		expect(computeTradeMetrics(trade([p], []), ENGINE).status).toBe('planned');
	});

	it('honours an explicit strategy override', () => {
		const s = leg({ kind: 'stock' });
		const t = trade([s], [fill(s, 'buy', 1, 1, '2026-10-01T14:00:00.000Z')], { strategy: 'custom' });
		const m = computeTradeMetrics(t, ENGINE);
		expect(m.strategy).toBe('custom');
		expect(m.detectedStrategy).toBe('shares_long');
	});
});
