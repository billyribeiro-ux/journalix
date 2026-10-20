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
		let next = index;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
		else return;
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
		min-height: 30px;
		font-size: var(--text-sm);
		font-weight: 500;
		white-space: nowrap;
	}

	.sm button {
		min-height: 24px;
		padding: 0 var(--space-2);
		font-size: var(--text-xs);
	}

	button:hover {
		color: var(--color-ink);
	}

	button[aria-checked='true'] {
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: 0 0 0 1px var(--color-line-strong);
	}
</style>
