<script lang="ts">
	import type { Snippet } from 'svelte';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg';
		children: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		description,
		size = 'md',
		children,
		footer,
		onclose
	}: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	const id = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function close(): void {
		open = false;
		onclose?.();
	}

	function onclick(event: MouseEvent): void {
		// Clicking the backdrop (the dialog element itself) closes.
		if (event.target === dialog) close();
	}
</script>

<dialog
	bind:this={dialog}
	class={size}
	aria-labelledby="{id}-title"
	aria-describedby={description ? `${id}-desc` : undefined}
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	{onclick}
>
	{#if open}
		<div class="panel">
			<header>
				<div>
					<h2 id="{id}-title">{title}</h2>
					{#if description}<p id="{id}-desc">{description}</p>{/if}
				</div>
				<button type="button" class="close" aria-label="Close" onclick={close}
					><XIcon size={18} /></button
				>
			</header>
			<div class="body">{@render children()}</div>
			{#if footer}<footer>{@render footer()}</footer>{/if}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		padding: 0;
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: var(--shadow-overlay);
		width: min(560px, calc(100vw - 2 * var(--space-4)));
		max-height: calc(100dvh - 2 * var(--space-8));
	}

	dialog.sm {
		width: min(420px, calc(100vw - 2 * var(--space-4)));
	}

	dialog.lg {
		width: min(860px, calc(100vw - 2 * var(--space-4)));
	}

	dialog::backdrop {
		background: rgb(6 12 22 / 55%);
	}

	dialog[open] {
		animation: rise var(--duration-base) var(--ease-out);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}

	header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6) var(--space-3);
	}

	h2 {
		font-size: var(--text-lg);
	}

	header p {
		margin-top: var(--space-1);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.close {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-3);
	}

	.close:hover {
		background: var(--color-surface-2);
		color: var(--color-ink);
	}

	.body {
		padding: var(--space-3) var(--space-6) var(--space-5);
		overflow: auto;
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-6);
		border-top: 1px solid var(--color-line);
	}
</style>
