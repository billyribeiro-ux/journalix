<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		checked?: boolean;
		id: string;
		disabled?: boolean;
		children: Snippet;
		description?: string;
	}

	let { checked = $bindable(false), id, disabled = false, children, description }: Props = $props();
</script>

<div class="check">
	<input
		type="checkbox"
		{id}
		bind:checked
		{disabled}
		aria-describedby={description ? `${id}-desc` : undefined}
	/>
	<label for={id}>
		{@render children()}
		{#if description}<span class="desc" id="{id}-desc">{description}</span>{/if}
	</label>
</div>

<style>
	.check {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	input {
		appearance: none;
		display: grid;
		place-content: center;
		flex: none;
		width: 16px;
		height: 16px;
		/* Centres the box on the first 21px line of the label. */
		margin: 3px 0 0;
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-xs);
		background: var(--color-surface);
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		input:hover:not(:disabled, :checked) {
			border-color: var(--color-ink-3);
			transition-delay: var(--hover-delay-tint);
		}
	}

	input:checked {
		border-color: var(--color-signal-fg);
		background-color: var(--color-signal);
		/* Check mark in --color-signal-ink (#0f1b2d in both themes). */
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5 6.5 11.5 12.5 4.5' fill='none' stroke='%230f1b2d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-position: center;
		background-repeat: no-repeat;
	}

	input:focus-visible {
		transition-delay: 0s;
	}

	input:disabled {
		border-color: var(--color-line-strong);
		background-color: var(--color-surface-2);
		cursor: not-allowed;
	}

	input:disabled:checked {
		background-color: var(--color-surface-3);
		border-color: var(--color-line-strong);
	}

	label {
		display: grid;
		gap: 2px;
		font-size: var(--text-base);
		line-height: var(--leading-normal);
		cursor: pointer;
	}

	input:disabled + label {
		color: var(--color-ink-3);
		cursor: not-allowed;
	}

	.desc {
		font-size: var(--text-xs);
		line-height: var(--leading-snug);
		color: var(--color-ink-3);
	}

	/* Touch: the whole row is the target. */
	@media (pointer: coarse) {
		.check {
			align-items: center;
			min-height: var(--control-touch);
		}

		input {
			margin: 0;
		}
	}

	@media (forced-colors: active) {
		input:checked {
			forced-color-adjust: none;
			background-color: Highlight;
			border-color: Highlight;
		}

		input:disabled {
			border-color: GrayText;
		}
	}
</style>
