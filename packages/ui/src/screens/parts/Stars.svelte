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

	// Roving tabindex: one tab stop, on the selected star (or the first when unrated).
	function tabStop(n: number): boolean {
		return value === null ? n === 1 : value === n;
	}

	function onkeydown(event: KeyboardEvent): void {
		if (!onchange) return;
		const current = value ?? 0;
		let next: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, current + 1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
			next = Math.max(1, current - 1);
		else if (event.key === 'Home') next = 1;
		else if (event.key === 'End') next = 5;
		if (next === null) return;
		event.preventDefault();
		onchange(next);
		(event.currentTarget as HTMLElement)
			.querySelector<HTMLButtonElement>(`[data-star="${next}"]`)
			?.focus();
	}
</script>

{#if onchange}
	<div class="stars editable" role="radiogroup" aria-label={label} tabindex="-1" {onkeydown}>
		{#each [1, 2, 3, 4, 5] as n (n)}
			<button
				type="button"
				role="radio"
				id="{id}-{n}"
				data-star={n}
				aria-checked={value === n}
				aria-label="{n} of 5"
				tabindex={tabStop(n) ? 0 : -1}
				class={[value !== null && n <= value && 'on']}
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
	/* Filled vs outline is the signal; --color-signal-fg keeps the filled star at ≥ 4.5:1 on paper. */
	.stars {
		display: inline-flex;
		gap: 2px;
		color: var(--color-signal-fg);
	}

	.editable button {
		display: grid;
		place-items: center;
		width: var(--control-sm);
		height: var(--control-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-3);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-instant) var(--ease-out);
	}

	.editable button.on {
		color: var(--color-signal-fg);
	}

	@media (pointer: coarse) {
		.editable button {
			width: var(--control-touch);
			height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.editable button:hover {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.editable button:focus-visible,
	.editable button:active {
		transition-delay: 0s;
	}

	.editable button:active {
		transform: scale(0.9);
	}
</style>
