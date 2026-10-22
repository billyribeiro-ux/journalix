<script lang="ts" generics="T extends string">
	interface Props {
		value: T;
		options: readonly { readonly value: T; readonly label: string }[];
		label: string;
		size?: 'sm' | 'md';
		onchange?: (value: T) => void;
	}

	let { value = $bindable(), options, label, size = 'md', onchange }: Props = $props();

	function select(next: T): void {
		value = next;
		onchange?.(next);
	}

	function onkeydown(event: KeyboardEvent): void {
		const index = options.findIndex((o) => o.value === value);
		const forward = (index + 1) % options.length;
		const back = (index - 1 + options.length) % options.length;
		const keyed: Record<string, number> = {
			ArrowRight: forward,
			ArrowDown: forward,
			ArrowLeft: back,
			ArrowUp: back
		};
		const next = keyed[event.key];
		if (next === undefined) return;
		event.preventDefault();
		const option = options[next];
		if (option) {
			select(option.value);
			const group = event.currentTarget as HTMLElement;
			group.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
		}
	}
</script>

<div class="segmented {size}" role="radiogroup" aria-label={label} tabindex="-1" {onkeydown}>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			aria-checked={option.value === value}
			tabindex={option.value === value ? 0 : -1}
			onclick={() => select(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.segmented {
		display: inline-flex;
		/* Never stretch to a grid/flex cell's height or width (stretch only applies to `auto` sizes). */
		width: fit-content;
		height: fit-content;
		max-width: 100%;
		padding: 2px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
		gap: 2px;
	}

	button {
		border: 0;
		background: transparent;
		color: var(--color-ink-2);
		border-radius: var(--radius-xs);
		padding: 0 var(--space-3);
		min-height: var(--control-dense);
		font-size: var(--text-sm);
		font-weight: 500;
		line-height: 1;
		white-space: nowrap;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.sm button {
		min-height: 24px;
		padding: 0 var(--space-2);
		font-size: var(--text-xs);
	}

	@media (pointer: coarse) {
		button,
		.sm button {
			min-height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover:not([aria-checked='true']) {
			background: color-mix(in oklab, var(--color-surface) 55%, transparent);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	button:focus-visible,
	button:active {
		transition-delay: 0s;
	}

	/* Selected: lifted onto the surface, ringed at control contrast so it never relies on tint alone. */
	button[aria-checked='true'] {
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow:
			0 0 0 1px var(--color-control-line),
			0 1px 2px rgb(15 27 45 / 8%);
	}

	button:focus-visible {
		outline-offset: 0;
	}

	@media (forced-colors: active) {
		button[aria-checked='true'] {
			forced-color-adjust: none;
			background: Highlight;
			color: HighlightText;
		}
	}
</style>
