import { newId } from '@strikebook/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
	readonly id: string;
	readonly tone: ToastTone;
	readonly message: string;
	readonly detail?: string;
}

/** Transient status messages. Errors stay until dismissed; others clear after 4 seconds. */
export class Toaster {
	toasts = $state<Toast[]>([]);

	show(tone: ToastTone, message: string, detail?: string): void {
		const toast: Toast = { id: newId(), tone, message, ...(detail ? { detail } : {}) };
		this.toasts = [...this.toasts, toast].slice(-4);
		if (tone !== 'error') setTimeout(() => this.dismiss(toast.id), 4000);
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

	dismiss(id: string): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}
}
