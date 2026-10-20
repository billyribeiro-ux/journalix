<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import './control.css';

	interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
		value?: string;
		invalid?: boolean;
	}

	let { value = $bindable(''), invalid = false, rows = 4, ...rest }: Props = $props();
</script>

<textarea class="control" bind:value {rows} aria-invalid={invalid || undefined} {...rest}
></textarea>

<style>
	textarea {
		padding: var(--space-2) var(--space-3);
		line-height: var(--leading-normal);
		resize: vertical;
		min-height: 72px;
	}
</style>
