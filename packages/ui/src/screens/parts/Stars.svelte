<script lang="ts">
	import StarIcon from 'phosphor-svelte/lib/StarIcon';

	interface Props {
		value: number | null;
		label: string;
		/** When set, the stars are an editable radio group. */
		onchange?: (value: number | null) => void;
	}

	let { value, label, onchange }: Props = $props();
	const id = $props.id();
</script>

{#if onchange}
	<div class="stars editable" role="radiogroup" aria-label={label}>
		{#each [1, 2, 3, 4, 5] as n (n)}
			<button
				type="button"
				role="radio"
				id="{id}-{n}"
				aria-checked={value === n}
				aria-label="{n} of 5"
				onclick={() => onchange(value === n ? null : n)}
			>
				<StarIcon size={18} weight={value !== null && n <= value ? 'fill' : 'regular'} />
			</button>
		{/each}
	</div>
{:else}
	<span class="stars" role="img" aria-label="{label}: {value ?? 'not rated'}{value ? ' of 5' : ''}">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<StarIcon size={14} weight={value !== null && n <= value ? 'fill' : 'regular'} />
		{/each}
	</span>
{/if}

<style>
	.stars {
		display: inline-flex;
		gap: 2px;
		color: var(--color-signal);
	}

	.editable button {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-signal);
	}

	.editable button:hover {
		background: var(--color-surface-2);
	}

	.editable button[aria-checked='false'] {
		color: var(--color-ink-3);
	}
</style>
