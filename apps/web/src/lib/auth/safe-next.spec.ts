import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next.ts';

describe('safeNext', () => {
	it('keeps same-site paths', () => {
		expect(safeNext('/app/trades?x=1')).toBe('/app/trades?x=1');
	});
	it('rejects external and protocol-relative targets', () => {
		expect(safeNext('https://evil.example')).toBe('/app');
		expect(safeNext('//evil.example/path')).toBe('/app');
		expect(safeNext('/\\evil.example')).toBe('/app');
		expect(safeNext('javascript:alert(1)')).toBe('/app');
		expect(safeNext(null)).toBe('/app');
	});
	it('rejects paths that normalise to a protocol-relative target', () => {
		for (const raw of [
			'/.//evil.com',
			'/x/..//evil.com',
			'/%2e//evil.com',
			'/./\\evil.com',
			'/.\\/evil.com'
		]) {
			const next = safeNext(raw);
			expect(next, raw).toBe('/app');
		}
	});
	it('still normalises harmless dot segments', () => {
		expect(safeNext('/app/./trades')).toBe('/app/trades');
	});
});
