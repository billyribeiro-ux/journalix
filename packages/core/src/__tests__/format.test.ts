import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, formatPercent, formatR, fromLocalInput, toLocalInput } from '../format/index.ts';
import { newId } from '../util/id.ts';
import { sum } from '../util/math.ts';

describe('formatting', () => {
	it('uses a true minus sign and optional plus', () => {
		expect(formatMoney(-1234.5)).toBe('−$1,234.50');
		expect(formatMoney(12, { signed: true })).toBe('+$12.00');
		expect(formatMoney(0, { signed: true })).toBe('$0.00');
		expect(formatPercent(0.125)).toBe('12.5%');
		expect(formatR(-1.5)).toBe('−1.50R');
		expect(formatDuration(3_600_000 + 20 * 60_000)).toBe('1h 20m');
		expect(formatMoney(null)).toBe('—');
	});

	it('round-trips local datetime inputs across DST', () => {
		for (const iso of ['2026-03-09T14:30:00.000Z', '2026-11-02T15:05:00.000Z', '2026-07-01T13:30:00.000Z']) {
			expect(fromLocalInput(toLocalInput(iso, 'America/New_York'), 'America/New_York')).toBe(iso);
		}
		expect(fromLocalInput('2026-07-01T09:30', 'America/New_York')).toBe('2026-07-01T13:30:00.000Z');
	});
});

describe('utilities', () => {
	it('generates time-ordered UUIDv7 ids', () => {
		const a = newId(1000);
		const b = newId(2000);
		expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(a < b).toBe(true);
	});
	it('sums without floating-point drift', () => {
		expect(sum(Array.from({ length: 10 }, () => 0.1))).toBe(1);
	});
});
