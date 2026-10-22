<script lang="ts" generics="T extends string">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';

	interface Option {
		readonly value: T;
		readonly label: string;
		readonly color?: string;
		readonly group?: string;
	}

	interface Props {
		label: string;
		values?: T[];
		options: readonly Option[];
		/** Text when nothing is selected, e.g. "All symbols". */
		placeholder: string;
		searchable?: boolean;
		onchange?: (values: T[]) => void;
	}

	let {
		label,
		values = $bindable([]),
		options,
		placeholder,
		searchable = false,
		onchange
	}: Props = $props();

	const id = $props.id();
	let open = $state(false);
	let query = $state('');
	let root = $state<HTMLDivElement | null>(null);

	const visible = $derived(
		query.trim()
			? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
			: options
	);

	const summary = $derived.by(() => {
		if (values.length === 0) return placeholder;
		if (values.length === 1)
			return options.find((o) => o.value === values[0])?.label ?? placeholder;
		return `${values.length} selected`;
	});

	function toggle(value: T): void {
		values = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
		onchange?.(values);
	}

	function clear(): void {
		values = [];
		onchange?.(values);
	}

	// Dismiss on outside press, Escape, or focus moving to a real target outside the popover.
	function onpointerdown(event: PointerEvent): void {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}

	function onkeydown(event: KeyboardEvent): void {
		if (open && event.key === 'Escape') {
			open = false;
			root?.querySelector<HTMLButtonElement>('.trigger')?.focus();
		}
	}

	function onfocusout(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (open && next instanceof Node && root && !root.contains(next)) open = false;
	}
</script>

<svelte:document {onpointerdown} {onkeydown} />

<div class="multi" bind:this={root} role="presentation" {onfocusout}>
	<button
		type="button"
		class={['trigger', values.length > 0 && 'active']}
		aria-expanded={open}
		aria-controls={open ? `${id}-popover` : undefined}
		aria-label="{label}: {summary}"
		onclick={() => (open = !open)}
	>
		<span class="summary">{summary}</span>
		<span class="caret" aria-hidden="true"><CaretDownIcon size={12} /></span>
	</button>
	{#if open}
		<div class="popover" id="{id}-popover" role="group" aria-label={label}>
			{#if searchable}
				<input
					class="search"
					type="search"
					placeholder="Search"
					bind:value={query}
					aria-label="Search {label}"
				/>
			{/if}
			<ul role="list">
				{#each visible as option (option.value)}
					{const selected = $derived(values.includes(option.value))}
					<li>
						<button
							type="button"
							role="checkbox"
							aria-checked={selected}
							onclick={() => toggle(option.value)}
						>
							<span class="box" aria-hidden="true">
								{#if selected}<CheckIcon size={12} weight="bold" />{/if}
							</span>
							{#if option.color}<span class="dot" style:background={option.color} aria-hidden="true"
								></span>{/if}
							<span class="text">{option.label}</span>
						</button>
					</li>
				{:else}
					<li class="none">No matches</li>
				{/each}
			</ul>
			{#if values.length > 0}
				<button type="button" class="clear" onclick={clear}>Clear selection</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.multi {
		position: relative;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: var(--control-dense);
		max-width: 220px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		.trigger {
			height: var(--control-touch);
			font-size: max(16px, var(--text-sm));
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.trigger:hover {
			border-color: var(--color-ink-3);
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.trigger:focus-visible,
	.trigger:active {
		transition-delay: 0s;
	}

	.trigger.active {
		border-color: var(--color-signal-fg);
		color: var(--color-ink);
		background: var(--color-signal-soft);
	}

	.trigger[aria-expanded='true'] {
		border-color: var(--color-ink-3);
	}

	.summary {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.caret {
		display: inline-flex;
		flex: none;
		transition: transform var(--duration-base) var(--ease-out);
	}

	.trigger[aria-expanded='true'] .caret {
		transform: rotate(180deg);
	}

	.popover {
		position: absolute;
		top: calc(100% + var(--space-1));
		inset-inline-start: 0;
		z-index: var(--z-overlay);
		min-width: 220px;
		max-width: min(320px, calc(100vw - 2 * var(--space-4)));
		padding: var(--space-1);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-pop);
		transform-origin: top left;
		animation: pop var(--duration-base) var(--ease-out-strong);
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
	}

	.search {
		width: 100%;
		height: var(--control-dense);
		margin-bottom: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
		font-size: var(--text-sm);
	}

	.search:focus-visible {
		outline-offset: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 280px;
		overflow: auto;
		overscroll-behavior: contain;
	}

	li button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--control-dense);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		text-align: start;
		font-size: var(--text-sm);
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		li button {
			min-height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		li button:hover {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	/* The list scrolls, so the ring sits inside it rather than being clipped. */
	li button:focus-visible,
	.clear:focus-visible {
		background: var(--color-hover);
		outline-offset: -2px;
		transition-delay: 0s;
	}

	li button:active {
		background: var(--color-pressed);
		transition-delay: 0s;
	}

	.text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.box {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-xs);
		flex: none;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	[aria-checked='true'] .box {
		background: var(--color-signal);
		border-color: var(--color-signal-fg);
		color: var(--color-signal-ink);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}

	.none {
		padding: var(--space-2);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.clear {
		width: 100%;
		min-height: var(--control-dense);
		margin-top: var(--space-1);
		padding: 0 var(--space-2);
		border: 0;
		border-top: 1px solid var(--color-line);
		border-radius: 0 0 var(--radius-xs) var(--radius-xs);
		background: transparent;
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		transition: color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.clear:hover {
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	@media (forced-colors: active) {
		[aria-checked='true'] .box {
			forced-color-adjust: none;
			background: Highlight;
			border-color: Highlight;
			color: HighlightText;
		}
	}
</style>
