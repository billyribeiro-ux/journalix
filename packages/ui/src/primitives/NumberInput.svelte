<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './control.css';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'type'> {
		/** `null` when empty. */
		value?: number | null;
		invalid?: boolean;
		describedBy?: string;
		prefix?: string;
		suffix?: string;
	}

	let {
		value = $bindable(null),
		invalid = false,
		describedBy,
		prefix,
		suffix,
		step = 'any',
		...rest
	}: Props = $props();

	let text = $state(value === null || value === undefined ? '' : String(value));

	// Keep the text in sync when the value changes from outside (e.g. a reset).
	$effect(() => {
		const parsed = text.trim() === '' ? null : Number(text);
		if (value !== parsed && !(Number.isNaN(parsed) && value === null)) {
			text = value === null || value === undefined ? '' : String(value);
		}
	});

	function oninput(event: Event & { currentTarget: HTMLInputElement }): void {
		text = event.currentTarget.value;
		const trimmed = text.trim();
		if (trimmed === '') value = null;
		else {
			const n = Number(trimmed);
			value = Number.isFinite(n) ? n : null;
		}
	}
</script>

<div
	class={['wrap', prefix && 'has-prefix', suffix && 'has-suffix']}
	style:--prefix-ch={prefix?.length}
	style:--suffix-ch={suffix?.length}
>
	{#if prefix}<span class="affix prefix" aria-hidden="true">{prefix}</span>{/if}
	<input
		class="control num"
		type="number"
		inputmode="decimal"
		{step}
		value={text}
		{oninput}
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		{...rest}
	/>
	{#if suffix}<span class="affix suffix" aria-hidden="true">{suffix}</span>{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	input {
		text-align: end;
	}

	/* Room for the affix is measured from its length, so "$" and "USD" both fit. */
	.has-prefix input {
		padding-inline-start: calc(var(--space-3) + var(--prefix-ch, 1) * 1ch + var(--space-2));
	}

	.has-suffix input {
		padding-inline-end: calc(var(--space-3) + var(--suffix-ch, 1) * 1ch + var(--space-2));
	}

	.affix {
		position: absolute;
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		pointer-events: none;
	}

	.prefix {
		inset-inline-start: var(--space-3);
	}

	.suffix {
		inset-inline-end: var(--space-3);
	}

	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
