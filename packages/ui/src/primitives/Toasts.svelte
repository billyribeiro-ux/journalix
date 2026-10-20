<script lang="ts">
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { Toaster } from '../app/toaster.svelte.ts';

	interface Props {
		toaster: Toaster;
	}

	let { toaster }: Props = $props();
</script>

<div class="toasts" aria-live="polite" aria-relevant="additions">
	{#each toaster.toasts as toast (toast.id)}
		<div class="toast {toast.tone}" role={toast.tone === 'error' ? 'alert' : 'status'}>
			<span class="icon" aria-hidden="true">
				{#if toast.tone === 'success'}<CheckCircleIcon size={18} weight="fill" />{:else if toast.tone === 'error'}<WarningCircleIcon size={18} weight="fill" />{:else}<InfoIcon size={18} weight="fill" />{/if}
			</span>
			<div class="text">
				<p class="message">{toast.message}</p>
				{#if toast.detail}<p class="detail">{toast.detail}</p>{/if}
			</div>
			<button type="button" aria-label="Dismiss" onclick={() => toaster.dismiss(toast.id)}><XIcon size={14} /></button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		right: var(--space-4);
		bottom: var(--space-4);
		z-index: var(--z-toast);
		display: grid;
		gap: var(--space-2);
		width: min(380px, calc(100vw - 2 * var(--space-4)));
	}

	.toast {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-3);
		align-items: start;
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-left: 3px solid var(--color-ink-3);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-overlay);
		animation: in var(--duration-base) var(--ease-out);
	}

	@keyframes in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	.success {
		border-left-color: var(--color-gain);
	}

	.success .icon {
		color: var(--color-gain);
	}

	.error {
		border-left-color: var(--color-loss);
	}

	.error .icon {
		color: var(--color-loss);
	}

	.icon {
		display: flex;
		padding-top: 1px;
		color: var(--color-ink-3);
	}

	.message {
		font-weight: 500;
	}

	.detail {
		margin-top: 2px;
		font-size: var(--text-sm);
		color: var(--color-ink-3);
		overflow-wrap: anywhere;
	}

	button {
		border: 0;
		background: transparent;
		color: var(--color-ink-3);
		padding: 2px;
		display: flex;
	}
</style>
