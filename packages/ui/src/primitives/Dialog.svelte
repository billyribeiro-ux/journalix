<script lang="ts">
	import { tick, type Snippet } from 'svelte';
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
	// Content stays mounted while the exit transition plays, then is dropped so the next open is fresh.
	let mounted = $state(false);

	$effect(() => {
		if (!dialog) return;
		if (open) {
			mounted = true;
			if (!dialog.open) {
				const el = dialog;
				void tick().then(() => {
					if (!open || el.open) return;
					el.showModal();
					focusFirst(el);
				});
			}
		} else if (dialog.open) {
			const el = dialog;
			el.close();
			// Transitions on the closing dialog are visible to getAnimations(); none -> resolves at once.
			void Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished)).then(
				() => {
					if (!open) mounted = false;
				}
			);
		} else {
			mounted = false;
		}
	});

	/** First field in the body, else the first footer action (the safe one: Cancel comes first). */
	function focusFirst(el: HTMLDialogElement): void {
		const target =
			el.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ??
			el.querySelector<HTMLElement>(
				'.body input:not([type="hidden"]):not(:disabled), .body select:not(:disabled), .body textarea:not(:disabled)'
			) ??
			el.querySelector<HTMLElement>('footer button:not(:disabled)');
		target?.focus();
	}

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
	{#if mounted}
		<div class="panel">
			<header>
				<div class="titles">
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
		overscroll-behavior: contain;
	}

	dialog.sm {
		width: min(420px, calc(100vw - 2 * var(--space-4)));
	}

	dialog.lg {
		width: min(860px, calc(100vw - 2 * var(--space-4)));
	}

	dialog::backdrop {
		background: var(--color-scrim);
	}

	/* Fallback (no @starting-style / allow-discrete): a keyframe entrance, no exit animation. */
	dialog[open] {
		animation: rise var(--duration-slow) var(--ease-out-strong);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(var(--rise)) scale(0.98);
		}
	}

	/*
	 * Enter and exit with transitions on the top layer: `display` and `overlay` transition discretely
	 * so the dialog (and its backdrop) stay rendered until the exit finishes. The exit is quicker
	 * (ease-in, ~60% of the entrance); the entrance lands softly (ease-out-strong).
	 */
	@supports (transition-behavior: allow-discrete) and (selector(:modal)) {
		dialog,
		dialog[open] {
			animation: none;
		}

		dialog {
			opacity: 0;
			transform: translateY(var(--rise)) scale(0.98);
			transition:
				opacity var(--duration-fast) var(--ease-in),
				transform var(--duration-fast) var(--ease-in),
				overlay var(--duration-fast) allow-discrete,
				display var(--duration-fast) allow-discrete;
		}

		dialog[open] {
			opacity: 1;
			transform: none;
			transition:
				opacity var(--duration-slow) var(--ease-out-strong),
				transform var(--duration-slow) var(--ease-out-strong),
				overlay var(--duration-slow) allow-discrete,
				display var(--duration-slow) allow-discrete;
		}

		@starting-style {
			dialog[open] {
				opacity: 0;
				transform: translateY(var(--rise)) scale(0.98);
			}
		}

		dialog::backdrop {
			background: transparent;
			transition:
				background-color var(--duration-fast) var(--ease-in),
				overlay var(--duration-fast) allow-discrete,
				display var(--duration-fast) allow-discrete;
		}

		dialog[open]::backdrop {
			background: var(--color-scrim);
			transition:
				background-color var(--duration-slow) var(--ease-out),
				overlay var(--duration-slow) allow-discrete,
				display var(--duration-slow) allow-discrete;
		}

		@starting-style {
			dialog[open]::backdrop {
				background: transparent;
			}
		}
	}

	/* Page behind a modal does not scroll. */
	:global(html:has(dialog:modal)) {
		overflow: hidden;
	}

	.panel {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6) var(--space-3);
	}

	.titles {
		min-width: 0;
	}

	h2 {
		font-size: var(--text-lg);
		line-height: var(--leading-snug);
	}

	header p {
		margin-top: var(--space-1);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
	}

	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--control-dense);
		height: var(--control-dense);
		margin: calc(-1 * var(--space-1)) calc(-1 * var(--space-2)) 0 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-3);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		.close {
			width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.close:hover {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.close:focus-visible,
	.close:active {
		transition-delay: 0s;
	}

	.body {
		padding: var(--space-3) var(--space-6) var(--space-5);
		overflow: auto;
		overscroll-behavior: contain;
	}

	footer {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-6);
		border-top: 1px solid var(--color-line);
	}

	@media (max-width: 480px) {
		header {
			padding: var(--space-4) var(--space-4) var(--space-2);
		}

		.body {
			padding-inline: var(--space-4);
		}

		footer {
			padding: var(--space-3) var(--space-4);
		}
	}
</style>
