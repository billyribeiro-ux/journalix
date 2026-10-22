<script lang="ts">
	interface Props {
		/** Plot-area rectangle in the wrapper's coordinate space (px). */
		left: number;
		top: number;
		width: number;
		height: number;
		/** Accessible name, e.g. "Equity curve, use arrow keys to step through trades". */
		label: string;
		count: number;
		active: number | null;
		/** Spoken value for the active index. */
		valueText: string;
		onactive: (index: number | null) => void;
		/** Maps a pointer position (relative to this surface) to a data index. */
		locate: (x: number, y: number) => number | null;
		/** Called on click, Enter or Space for the active index. */
		onpress?: (index: number) => void;
	}

	let {
		left,
		top,
		width,
		height,
		label,
		count,
		active,
		valueText,
		onactive,
		locate,
		onpress
	}: Props = $props();

	let focused = $state(false);

	function fromPointer(event: PointerEvent): number | null {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		return locate(event.clientX - rect.left, event.clientY - rect.top);
	}

	function onpointermove(event: PointerEvent): void {
		onactive(fromPointer(event));
	}

	function onpointerleave(event: PointerEvent): void {
		// A finger lifting is not the pointer leaving: on touch the readout stays until focus moves away.
		if (event.pointerType === 'touch') return;
		if (!focused) onactive(null);
	}

	function onkeydown(event: KeyboardEvent): void {
		if (count === 0) return;
		const current = active ?? count - 1;
		let next: number;
		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				next = current + 1;
				break;
			case 'ArrowLeft':
			case 'ArrowDown':
				next = current - 1;
				break;
			case 'PageUp':
				next = current + 10;
				break;
			case 'PageDown':
				next = current - 10;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = count - 1;
				break;
			case 'Enter':
			case ' ':
				if (onpress && active !== null) {
					event.preventDefault();
					onpress(active);
				}
				return;
			case 'Escape':
				onactive(null);
				return;
			default:
				return;
		}
		event.preventDefault();
		onactive(Math.max(0, Math.min(count - 1, next)));
	}

	function onclick(event: MouseEvent): void {
		if (!onpress) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const index = locate(event.clientX - rect.left, event.clientY - rect.top);
		if (index !== null) onpress(index);
	}
</script>

<div
	class={['scrub', onpress !== undefined && 'pressable']}
	role="slider"
	tabindex="0"
	aria-label={label}
	aria-valuemin={1}
	aria-valuemax={Math.max(1, count)}
	aria-valuenow={(active ?? count - 1) + 1}
	aria-valuetext={valueText}
	style:left="{left}px"
	style:top="{top}px"
	style:width="{Math.max(0, width)}px"
	style:height="{Math.max(0, height)}px"
	{onpointermove}
	onpointerdown={onpointermove}
	{onpointerleave}
	{onkeydown}
	{onclick}
	onfocus={() => {
		focused = true;
		if (active === null && count > 0) onactive(count - 1);
	}}
	onblur={() => {
		focused = false;
		onactive(null);
	}}
></div>

<style>
	.scrub {
		position: absolute;
		touch-action: pan-y;
		cursor: crosshair;
		border-radius: var(--radius-xs);
	}

	.scrub.pressable {
		cursor: pointer;
	}

	.scrub:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
</style>
