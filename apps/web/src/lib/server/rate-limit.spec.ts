import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit.ts';

describe('RateLimiter', () => {
	it('allows up to max hits per window, then blocks until it resets', () => {
		let now = 0;
		const limiter = new RateLimiter(() => now);
		const rule = { max: 2, windowMs: 1000 };
		expect(limiter.hit('a', rule).allowed).toBe(true);
		expect(limiter.hit('a', rule).allowed).toBe(true);
		const blocked = limiter.hit('a', rule);
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfter).toBe(1);
		expect(limiter.hit('b', rule).allowed).toBe(true);
		now = 1000;
		expect(limiter.hit('a', rule).allowed).toBe(true);
	});

	it('forgets a key on reset', () => {
		const limiter = new RateLimiter(() => 0);
		const rule = { max: 1, windowMs: 1000 };
		limiter.hit('a', rule);
		expect(limiter.hit('a', rule).allowed).toBe(false);
		limiter.reset('a');
		expect(limiter.hit('a', rule).allowed).toBe(true);
	});
});
