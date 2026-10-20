import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { createSampleJournal } from '../sample/index.ts';
import { JournalExportSchema } from '../domain/schemas.ts';
import { buildTradeViews } from '../engine/position.ts';
import { computeStats } from '../analytics/kpis.ts';
import { entryGreeks } from '../options/greeks-analysis.ts';

describe('sample journal', () => {
	const journal = createSampleJournal({ endDay: '2026-10-16', seed: 7 });
	const views = buildTradeViews(journal.trades, {
		timeZone: 'America/New_York',
		breakevenThreshold: 1
	});

	it('is valid against the export schema', () => {
		const result = v.safeParse(JournalExportSchema, journal);
		if (!result.success) console.error(result.issues.slice(0, 3));
		expect(result.success).toBe(true);
	});

	it('produces a realistic mix of strategies, outcomes and open trades', () => {
		const strategies = new Set(views.map((x) => x.metrics.strategy));
		for (const s of [
			'long_call',
			'long_put',
			'iron_condor',
			'bull_put_spread',
			'shares_long',
			'covered_call'
		]) {
			expect(strategies.has(s as never), s).toBe(true);
		}
		expect(views.some((x) => x.metrics.status === 'open')).toBe(true);
		const stats = computeStats(views);
		expect(stats.trades).toBeGreaterThan(100);
		expect(stats.wins).toBeGreaterThan(20);
		expect(stats.losses).toBeGreaterThan(20);
	});

	it('records underlying prices so option Greeks can be solved', () => {
		const option = views.find(
			(x) => x.metrics.strategy === 'long_call' && x.metrics.status === 'closed'
		);
		expect(option).toBeDefined();
		if (!option) return;
		const g = entryGreeks(option, 0.04);
		expect(g).not.toBeNull();
		expect(g?.delta).toBeGreaterThan(0);
	});

	it('is deterministic for a seed', () => {
		const again = createSampleJournal({ endDay: '2026-10-16', seed: 7 });
		expect(again.trades.map((t) => t.executions.map((e) => e.price))).toEqual(
			journal.trades.map((t) => t.executions.map((e) => e.price))
		);
	});

	it('never contains fills, levels or notes after the generation time', () => {
		const now = Date.parse('2026-10-16T17:00:00Z'); // 1 pm in New York, mid-session
		const midday = createSampleJournal({ endDay: '2026-10-16', seed: 7, now });
		expect(v.safeParse(JournalExportSchema, midday).success).toBe(true);
		for (const t of midday.trades) {
			expect(t.executions.length).toBeGreaterThan(0);
			for (const e of t.executions) expect(Date.parse(e.executedAt)).toBeLessThanOrEqual(now);
			for (const l of t.levels) expect(Date.parse(l.setAt)).toBeLessThanOrEqual(now);
		}
		for (const n of midday.notes) expect(Date.parse(n.createdAt)).toBeLessThanOrEqual(now);
	});

	it('keeps near-expiry theta within the option value', () => {
		for (const view of views) {
			const g = entryGreeks(view, 0.04);
			if (!g || view.metrics.dteAtEntry !== 0) continue;
			const premium = Math.abs(view.metrics.openingCashflow);
			expect(Math.abs(g.theta)).toBeLessThanOrEqual(premium + 1e-3);
		}
	});
});
