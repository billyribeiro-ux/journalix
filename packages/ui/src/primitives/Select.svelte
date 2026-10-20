<script lang="ts" generics="T extends string">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import './control.css';

	interface Option {
		readonly value: T;
		readonly label: string;
		readonly disabled?: boolean;
	}

	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		value?: T;
		options: readonly Option[];
		groups?: readonly { readonly label: string; readonly options: readonly Option[] }[];
		placeholder?: string;
		invalid?: boolean;
	}

	let {
		value = $bindable(),
		options,
		groups,
		placeholder,
		invalid = false,
		...rest
	}: Props = $props();
</script>

<div class="wrap">
	<select class="control" bind:value aria-invalid={invalid || undefined} {...rest}>
		{#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
		{#each options as option (option.value)}
			<option value={option.value} disabled={option.disabled}>{option.label}</option>
		{/each}
		{#each groups ?? [] as group (group.label)}
			<optgroup label={group.label}>
				{#each group.options as option (option.value)}
					<option value={option.value} disabled={option.disabled}>{option.label}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
	<svg class="chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
		<path
			d="M3 4.5 6 7.5 9 4.5"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	</svg>
</div>

<style>
	.wrap {
		position: relative;
	}

	select {
		appearance: none;
		padding-right: calc(var(--space-3) + 16px);
		cursor: pointer;
	}

	.chevron {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-ink-3);
		pointer-events: none;
	}
</style>
