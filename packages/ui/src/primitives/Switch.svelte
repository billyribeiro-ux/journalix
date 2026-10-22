<script lang="ts">
	interface Props {
		checked?: boolean;
		label: string;
		id: string;
		disabled?: boolean;
	}

	let { checked = $bindable(false), label, id, disabled = false }: Props = $props();
</script>

<label class="switch" for={id}>
	<input {id} type="checkbox" role="switch" bind:checked {disabled} aria-checked={checked} />
	<span class="track" aria-hidden="true"><span class="thumb"></span></span>
	<span class="text">{label}</span>
</label>

<style>
	.switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--control-sm);
		cursor: pointer;
		font-size: var(--text-base);
	}

	.switch:has(input:disabled) {
		color: var(--color-ink-3);
		cursor: not-allowed;
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
		margin: 0;
	}

	.track {
		flex: none;
		width: 36px;
		height: 20px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-3);
		border: 1px solid var(--color-control-line);
		position: relative;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--color-ink-2);
		transition:
			transform var(--duration-fast) var(--ease-in-out),
			background-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.switch:hover input:not(:disabled, :checked) + .track {
			border-color: var(--color-ink-3);
			transition-delay: var(--hover-delay-tint);
		}
	}

	input:checked + .track {
		background: var(--color-signal);
		border-color: var(--color-signal-fg);
	}

	input:checked + .track .thumb {
		transform: translateX(16px);
		background: var(--color-signal-ink);
	}

	input:focus-visible + .track {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
		transition-delay: 0s;
	}

	input:disabled + .track {
		opacity: 0.55;
	}

	:global([dir='rtl']) .thumb {
		left: auto;
		right: 2px;
	}

	:global([dir='rtl']) input:checked + .track .thumb {
		transform: translateX(-16px);
	}

	@media (forced-colors: active) {
		.track,
		.thumb {
			forced-color-adjust: none;
		}

		.track {
			background: Canvas;
			border-color: CanvasText;
		}

		.thumb {
			background: CanvasText;
		}

		input:checked + .track {
			background: Highlight;
			border-color: Highlight;
		}

		input:checked + .track .thumb {
			background: HighlightText;
		}

		input:disabled + .track {
			border-color: GrayText;
			opacity: 1;
		}
	}
</style>
