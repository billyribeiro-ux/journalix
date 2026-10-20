<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './control.css';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		value?: string;
		invalid?: boolean;
		describedBy?: string;
	}

	let {
		value = $bindable(''),
		invalid = false,
		describedBy,
		type = 'text',
		...rest
	}: Props = $props();
</script>

<input
	class="control"
	{type}
	bind:value
	aria-invalid={invalid || undefined}
	aria-describedby={describedBy}
	{...rest}
/>
