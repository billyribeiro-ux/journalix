/**
 * Fixed-window rate limiter for SvelteKit form actions.
 *
 * Better Auth only rate-limits requests that pass through its HTTP handler; calls made with
 * `auth.api.*` from a form action skip that middleware, so sign-in and sign-up apply this limiter
 * themselves. State is per process: run one instance, or move the counters to a shared store
 * (Redis, PostgreSQL) before scaling horizontally.
 */
interface Window {
	count: number;
	resetAt: number;
}

export interface LimitRule {
	readonly max: number;
	readonly windowMs: number;
}

export interface LimitResult {
	readonly allowed: boolean;
	/** Seconds until the window resets, for a `Retry-After` hint. */
	readonly retryAfter: number;
}

const MAX_KEYS = 50_000;

export class RateLimiter {
	readonly #windows = new Map<string, Window>();
	readonly #now: () => number;

	constructor(now: () => number = Date.now) {
		this.#now = now;
	}

	/** Counts one attempt for `key` and reports whether it is within `rule`. */
	hit(key: string, rule: LimitRule): LimitResult {
		const now = this.#now();
		let window = this.#windows.get(key);
		if (!window || window.resetAt <= now) {
			if (this.#windows.size >= MAX_KEYS) this.#prune(now);
			window = { count: 0, resetAt: now + rule.windowMs };
			this.#windows.set(key, window);
		}
		window.count++;
		return {
			allowed: window.count <= rule.max,
			retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000))
		};
	}

	/** Clears a key, e.g. after a successful sign-in. */
	reset(key: string): void {
		this.#windows.delete(key);
	}

	#prune(now: number): void {
		for (const [key, window] of this.#windows) if (window.resetAt <= now) this.#windows.delete(key);
		// Still full: drop the oldest entries (Map iterates in insertion order).
		const excess = this.#windows.size - MAX_KEYS + 1;
		if (excess > 0) {
			let removed = 0;
			for (const key of this.#windows.keys()) {
				if (removed++ >= excess) break;
				this.#windows.delete(key);
			}
		}
	}
}

export const authLimiter = new RateLimiter();

export const AUTH_RULES = {
	/** Sign-in attempts per client address. */
	signInPerAddress: { max: 10, windowMs: 60_000 },
	/** Failed sign-ins per account, which slows password guessing spread across addresses. */
	signInPerEmail: { max: 10, windowMs: 15 * 60_000 },
	/** New accounts per client address. */
	signUpPerAddress: { max: 10, windowMs: 60 * 60_000 }
} as const satisfies Record<string, LimitRule>;
