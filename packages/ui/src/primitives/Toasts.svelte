<script lang="ts">
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Toaster } from '../app/toaster.svelte.ts';

	interface Props {
		toaster: Toaster;
	}

	let { toaster }: Props = $props();

	// Svelte transitions run on the Web Animations API, so the global reduced-motion CSS cannot
	// reach them: collapse the durations here.
	const enter = $derived(prefersReducedMotion.current ? 0 : 240);
	const leave = $derived(prefersReducedMotion.current ? 0 : 160);

	// The auto-dismiss countdown holds while a toast is hovered or has focus inside it, and resumes
	// with the time that was left once both are gone (WCAG 2.2.1 / 2.2.2: time to read).
	function holding(el: HTMLElement, related: EventTarget | null): boolean {
		return el.matches(':hover') || (related instanceof Node && el.contains(related));
	}

	function onfocusout(event: FocusEvent & { currentTarget: HTMLElement }, id: string): void {
		if (!holding(event.currentTarget, event.relatedTarget)) toaster.resume(id);
	}

	function onpointerleave(event: PointerEvent & { currentTarget: HTMLElement }, id: string): void {
		if (!event.currentTarget.matches(':focus-within')) toaster.resume(id);
	}
</script>

<div class="toasts" aria-live="polite" aria-relevant="additions">
	{#each toaster.toasts as toast (toast.id)}
		<div
			class={['toast', toast.tone]}
			role={toast.tone === 'error' ? 'alert' : 'status'}
			in:fly={{ y: 12, duration: enter }}
			out:fly={{ y: 6, duration: leave }}
			animate:flip={{ duration: enter }}
			onpointerenter={() => toaster.pause(toast.id)}
			onpointerleave={(e) => onpointerleave(e, toast.id)}
			onfocusin={() => toaster.pause(toast.id)}
			onfocusout={(e) => onfocusout(e, toast.id)}
		>
			<span class="icon" aria-hidden="true">
				{#if toast.tone === 'success'}<CheckCircleIcon
						size={18}
						weight="fill"
					/>{:else if toast.tone === 'error'}<WarningCircleIcon
						size={18}
						weight="fill"
					/>{:else}<InfoIcon size={18} weight="fill" />{/if}
			</span>
			<div class="text">
				<p class="message">{toast.message}</p>
				{#if toast.detail}<p class="detail">{toast.detail}</p>{/if}
			</div>
			<button type="button" aria-label="Dismiss" onclick={() => toaster.dismiss(toast.id)}
				><XIcon size={14} /></button
			>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		inset-inline-end: var(--space-4);
		bottom: max(var(--space-4), env(safe-area-inset-bottom));
		z-index: var(--z-toast);
		display: grid;
		gap: var(--space-2);
		width: min(380px, calc(100vw - 2 * var(--space-4)));
		/* The stack never blocks the page; only the toasts themselves take pointer input. */
		pointer-events: none;
	}

	.toast {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-3);
		align-items: start;
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-inline-start: 3px solid var(--color-ink-3);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-overlay);
		pointer-events: auto;
	}

	.success {
		border-inline-start-color: var(--color-gain);
	}

	.success .icon {
		color: var(--color-gain-text);
	}

	.error {
		border-inline-start-color: var(--color-loss);
	}

	.error .icon {
		color: var(--color-loss-text);
	}

	.icon {
		display: flex;
		padding-top: 1px;
		color: var(--color-ink-3);
	}

	.message {
		font-weight: 500;
		line-height: var(--leading-snug);
		padding-top: 1px;
	}

	.detail {
		margin-top: 2px;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		color: var(--color-ink-3);
		overflow-wrap: anywhere;
	}

	button {
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
		margin-block: -4px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-3);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		button {
			width: var(--control-touch);
			height: var(--control-touch);
			margin-block: -10px;
		}
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	button:focus-visible,
	button:active {
		transition-delay: 0s;
	}

	@media (forced-colors: active) {
		.toast {
			border: 1px solid CanvasText;
			border-inline-start-width: 4px;
		}
	}
</style>
