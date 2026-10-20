<script lang="ts">
	import type { HitTarget } from './chart-utils.ts';
	import { rovingIndex } from './chart-utils.ts';

	interface Props {
		targets: readonly HitTarget[];
		/** Accessible name of the group of marks. */
		label: string;
		/** Index of the mark under the pointer or keyboard focus. */
		active: number | null;
		onactive: (index: number | null) => void;
		/** Called on click, Enter or Space. Without it the marks only reveal details. */
		onpress?: (index: number) => void;
		/** Custom arrow-key mapping (e.g. for 2-D grids). Falls back to linear order. */
		navigate?: (key: string, index: number) => number | null;
		/** Mark that receives the single tab stop before the user has interacted. */
		initialIndex?: number;
		/** Index that should read as pressed/selected, if any. */
		selected?: number | null;
	}

	let {
		targets,
		label,
		active,
		onactive,
		onpress,
		navigate,
		initialIndex,
		selected = null
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	let focused = $state<number | null>(null);
	let lastFocused = $state<number | null>(null);

	const tabStop = $derived.by(() => {
		const count = targets.length;
		if (count === 0) return -1;
		const preferred = lastFocused ?? selected ?? initialIndex ?? 0;
		return Math.min(count - 1, Math.max(0, preferred));
	});

	function moveTo(index: number): void {
		const el = container?.querySelector<HTMLButtonElement>(`button[data-index="${index}"]`);
		el?.focus();
	}

	function onkeydown(event: KeyboardEvent, index: number): void {
		if (event.key === 'Escape') {
			onactive(null);
			return;
		}
		const next = navigate
			? navigate(event.key, index)
			: rovingIndex(event.key, index, targets.length);
		if (next === null) return;
		event.preventDefault();
		if (next !== index && next >= 0 && next < targets.length) moveTo(next);
	}

	function onfocusout(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (next instanceof Node && container?.contains(next)) return;
		focused = null;
		onactive(null);
	}
</script>

<div
	class="targets"
	role="group"
	aria-label={label}
	bind:this={container}
	{onfocusout}
	onpointerleave={() => focused === null && onactive(null)}
>
	{#each targets as target, i (target.key)}
		<button
			type="button"
			class="target"
			class:pressable={onpress !== undefined}
			class:on={active === i}
			data-index={i}
			tabindex={i === tabStop ? 0 : -1}
			aria-label={target.label}
			aria-pressed={selected === null ? undefined : selected === i}
			style:left="{target.x}px"
			style:top="{target.y}px"
			style:width="{target.w}px"
			style:height="{target.h}px"
			onpointerenter={() => onactive(i)}
			onfocus={() => {
				focused = i;
				lastFocused = i;
				onactive(i);
			}}
			onkeydown={(e) => onkeydown(e, i)}
			onclick={() => onpress?.(i)}
		></button>
	{/each}
</div>

<style>
	.targets {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.target {
		position: absolute;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		pointer-events: auto;
		cursor: default;
		border-radius: var(--radius-xs);
	}

	.target.pressable {
		cursor: pointer;
	}

	.target:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}
</style>
