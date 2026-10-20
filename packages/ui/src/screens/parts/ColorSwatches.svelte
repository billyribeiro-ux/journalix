<script lang="ts" module>
	/** Identity colours for tags and playbooks: the validated series hues, then two neutrals. */
	export const SWATCHES: readonly { readonly value: string; readonly label: string }[] = [
		{ value: '#3778c8', label: 'Blue' },
		{ value: '#9a6f00', label: 'Ochre' },
		{ value: '#008c7a', label: 'Teal' },
		{ value: '#8b5fb9', label: 'Violet' },
		{ value: '#ba5530', label: 'Rust' },
		{ value: '#c2417a', label: 'Magenta' },
		{ value: '#5c6b7a', label: 'Slate' },
		{ value: '#8a8f98', label: 'Gray' }
	];
</script>

<script lang="ts">
	interface Props {
		value: string;
		label: string;
		name: string;
	}

	let { value = $bindable(), label, name }: Props = $props();
</script>

<fieldset class="swatches">
	<legend>{label}</legend>
	<div class="row">
		{#each SWATCHES as swatch (swatch.value)}
			<label class="swatch" style:--swatch={swatch.value} title={swatch.label}>
				<input type="radio" {name} value={swatch.value} bind:group={value} />
				<span class="visually-hidden">{swatch.label}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.swatches {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		margin-bottom: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--color-ink-2);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.swatch {
		position: relative;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--swatch);
		cursor: pointer;
		box-shadow: 0 0 0 2px var(--color-surface);
	}

	.swatch:has(input:checked) {
		box-shadow:
			0 0 0 2px var(--color-surface),
			0 0 0 4px var(--color-ink);
	}

	.swatch:has(input:focus-visible) {
		outline: 2px solid var(--color-focus);
		outline-offset: 4px;
	}

	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
</style>
