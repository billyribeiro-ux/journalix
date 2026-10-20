<script lang="ts">
	interface Props {
		checked?: boolean;
		label: string;
		id: string;
		disabled?: boolean;
	}

	let { checked = $bindable(false), label, id, disabled = false }: Props = $props();
</script>

<label class="switch" for={id}>
	<input {id} type="checkbox" role="switch" bind:checked {disabled} aria-checked={checked} />
	<span class="track" aria-hidden="true"><span class="thumb"></span></span>
	<span class="text">{label}</span>
</label>

<style>
	.switch {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		font-size: var(--text-base);
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.track {
		width: 32px;
		height: 18px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-3);
		border: 1px solid var(--color-line-strong);
		position: relative;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-ink-2);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	input:checked + .track {
		background: var(--color-signal);
		border-color: var(--color-signal);
	}

	input:checked + .track .thumb {
		transform: translateX(14px);
		background: var(--color-signal-ink);
	}

	input:focus-visible + .track {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
</style>
