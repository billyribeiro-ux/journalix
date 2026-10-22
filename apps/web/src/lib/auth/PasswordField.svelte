<script lang="ts">
	import { Field, TextInput } from '@journalix/ui';

	interface Props {
		label: string;
		id: string;
		name: string;
		autocomplete: 'current-password' | 'new-password';
		value?: string;
		help?: string;
		error?: string | null;
		minlength?: number;
		maxlength?: number;
		/** Id of the element that describes the field. Defaults to the Field's own help or error. */
		describedBy?: string;
	}

	let {
		label,
		id,
		name,
		autocomplete,
		value = $bindable(''),
		help,
		error = null,
		minlength,
		maxlength,
		describedBy
	}: Props = $props();

	let shown = $state(false);
</script>

<Field {label} for={id} {help} {error}>
	<div class="wrap">
		<TextInput
			{id}
			{name}
			{autocomplete}
			{minlength}
			{maxlength}
			required
			type={shown ? 'text' : 'password'}
			bind:value
			invalid={!!error}
			describedBy={describedBy ?? (error ? `${id}-error` : help ? `${id}-help` : undefined)}
			autocapitalize="none"
			spellcheck={false}
		/>
		<!-- The visible word and the accessible name start the same way (WCAG 2.5.3). -->
		<button type="button" class="toggle" aria-controls={id} onclick={() => (shown = !shown)}>
			{shown ? 'Hide' : 'Show'}<span class="visually-hidden"> password</span>
		</button>
	</div>
</Field>

<style>
	.wrap {
		position: relative;
		display: grid;
	}

	.wrap :global(input) {
		padding-right: 4.25rem;
	}

	.toggle {
		position: absolute;
		top: 50%;
		right: var(--space-1);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 28px;
		padding: 0 var(--space-2);
		transform: translateY(-50%);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.toggle:hover {
			background: var(--color-hover);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.toggle:focus-visible,
	.toggle:active {
		transition-delay: 0s;
	}

	.toggle:active {
		background: var(--color-pressed);
	}

	@media (pointer: coarse) {
		.toggle {
			min-height: 40px;
			min-width: 44px;
		}
	}
</style>
