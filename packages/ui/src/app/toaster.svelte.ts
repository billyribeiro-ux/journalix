import { newId } from '@journalix/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
	readonly id: string;
	readonly tone: ToastTone;
	readonly message: string;
	readonly detail?: string;
}

/** How long a non-error toast stays: long enough to read it once (WCAG 2.2.1), longer with a detail line. */
const LIFETIME_MS = 5000;
const LIFETIME_WITH_DETAIL_MS = 8000;

interface Countdown {
	remaining: number;
	/** `null` while paused. */
	startedAt: number | null;
	timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Transient status messages. Errors stay until dismissed; the others clear on their own, but the
 * countdown is paused while the pointer is over a toast or focus is inside it (`pause`/`resume`),
 * and resumes with the time that was left — so a message being read is never pulled away.
 */
export class Toaster {
	toasts = $state.raw<Toast[]>([]);

	// Bookkeeping only, never rendered, so it is deliberately not reactive.
	readonly #countdowns = new Map<string, Countdown>();

	show(tone: ToastTone, message: string, detail?: string): void {
		const toast: Toast = { id: newId(), tone, message, ...(detail ? { detail } : {}) };
		const next = [...this.toasts, toast];
		const dropped = next.slice(0, Math.max(0, next.length - 4));
		this.toasts = next.slice(-4);
		for (const old of dropped) this.#forget(old.id);
		if (tone !== 'error') {
			const remaining = detail ? LIFETIME_WITH_DETAIL_MS : LIFETIME_MS;
			this.#countdowns.set(toast.id, { remaining, startedAt: null, timer: null });
			this.resume(toast.id);
		}
	}

	success(message: string, detail?: string): void {
		this.show('success', message, detail);
	}

	error(message: string, detail?: string): void {
		this.show('error', message, detail);
	}

	info(message: string, detail?: string): void {
		this.show('info', message, detail);
	}

	/** Stops the auto-dismiss countdown (pointer over the toast, or focus inside it). */
	pause(id: string): void {
		const c = this.#countdowns.get(id);
		if (!c || c.startedAt === null) return;
		if (c.timer !== null) clearTimeout(c.timer);
		c.timer = null;
		c.remaining = Math.max(0, c.remaining - (Date.now() - c.startedAt));
		c.startedAt = null;
	}

	/** Restarts the countdown with whatever time was left. */
	resume(id: string): void {
		const c = this.#countdowns.get(id);
		if (!c || c.startedAt !== null) return;
		c.startedAt = Date.now();
		c.timer = setTimeout(() => this.dismiss(id), c.remaining);
	}

	dismiss(id: string): void {
		this.#forget(id);
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	#forget(id: string): void {
		const c = this.#countdowns.get(id);
		if (c && c.timer !== null) clearTimeout(c.timer);
		this.#countdowns.delete(id);
	}
}
