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

	$effect(() => {
		if (!open) return;
		const onpointer = (event: PointerEvent): void => {
			if (root && !root.contains(event.target as Node)) open = false;
		};
		const onkey = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				open = false;
				root?.querySelector<HTMLButtonElement>('.trigger')?.focus();
			}
		};
		document.addEventListener('pointerdown', onpointer);
		document.addEventListener('keydown', onkey);
		return () => {
			document.removeEventListener('pointerdown', onpointer);
			document.removeEventListener('keydown', onkey);
		};
	});
</script>

<div class="multi" bind:this={root}>
	<button
		type="button"
		class="trigger"
		class:active={values.length > 0}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-label="{label}: {summary}"
		onclick={() => (open = !open)}
	>
		<span class="summary">{summary}</span>
		<CaretDownIcon size={12} />
	</button>
	{#if open}
		<div class="popover">
			{#if searchable}
				<input
					class="search"
					type="search"
					placeholder="Search"
					bind:value={query}
					aria-label="Search {label}"
				/>
			{/if}
			<ul id="{id}-list" role="listbox" aria-multiselectable="true" aria-label={label}>
				{#each visible as option (option.value)}
					<li role="option" aria-selected={values.includes(option.value)}>
						<button type="button" onclick={() => toggle(option.value)}>
							<span class="box" aria-hidden="true">
								{#if values.includes(option.value)}<CheckIcon size={12} weight="bold" />{/if}
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
		height: 32px;
		max-width: 220px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink-2);
		font-size: var(--text-sm);
	}

	.trigger.active {
		border-color: var(--color-signal);
		color: var(--color-ink);
		background: var(--color-signal-soft);
	}

	.summary {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.popover {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: var(--z-overlay);
		min-width: 220px;
		max-width: 320px;
		padding: var(--space-1);
		background: var(--color-surface);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-overlay);
	}

	.search {
		width: 100%;
		height: 32px;
		margin-bottom: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 280px;
		overflow: auto;
	}

	li button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: 6px var(--space-2);
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		text-align: left;
		font-size: var(--text-sm);
	}

	li button:hover {
		background: var(--color-surface-2);
	}

	.box {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-xs);
		flex: none;
	}

	[aria-selected='true'] .box {
		background: var(--color-signal);
		border-color: var(--color-signal);
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
		margin-top: var(--space-1);
		padding: 6px;
		border: 0;
		border-top: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.clear:hover {
		color: var(--color-ink);
	}
</style>
