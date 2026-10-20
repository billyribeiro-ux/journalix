<script lang="ts">
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';
	import { addDays, dayKey, isFilterActive, STRATEGIES, type StrategyKind } from '@strikebook/core';
	import { useApp } from '../app/context.ts';
	import MultiSelect from '../primitives/MultiSelect.svelte';
	import Select from '../primitives/Select.svelte';

	const { journal } = useApp();

	type Preset = 'all' | 'today' | 'week' | 'month' | '30d' | '90d' | 'ytd' | 'custom';

	const PRESETS: readonly { value: Preset; label: string }[] = [
		{ value: 'all', label: 'All time' },
		{ value: 'today', label: 'Today' },
		{ value: 'week', label: 'This week' },
		{ value: 'month', label: 'This month' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: '90d', label: 'Last 90 days' },
		{ value: 'ytd', label: 'Year to date' },
		{ value: 'custom', label: 'Custom range' }
	];

	const today = $derived(dayKey(Date.now(), journal.settings.timeZone));

	function rangeFor(preset: Preset): { from: string | null; to: string | null } {
		switch (preset) {
			case 'all':
				return { from: null, to: null };
			case 'today':
				return { from: today, to: today };
			case 'week': {
				const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
				const offset = (weekday - journal.settings.weekStartsOn + 7) % 7;
				return { from: addDays(today, -offset), to: today };
			}
			case 'month':
				return { from: `${today.slice(0, 7)}-01`, to: today };
			case '30d':
				return { from: addDays(today, -29), to: today };
			case '90d':
				return { from: addDays(today, -89), to: today };
			case 'ytd':
				return { from: `${today.slice(0, 4)}-01-01`, to: today };
			case 'custom':
				return { from: journal.filter.from ?? addDays(today, -29), to: journal.filter.to ?? today };
		}
	}

	const currentPreset = $derived.by<Preset>(() => {
		const { from, to } = journal.filter;
		for (const p of PRESETS) {
			if (p.value === 'custom') continue;
			const r = rangeFor(p.value);
			if (r.from === from && r.to === to) return p.value;
		}
		return 'custom';
	});

	// "Custom range" stays selected while editing dates even if they happen to match a preset.
	let customMode = $state(false);
	const preset = $derived<Preset>(customMode ? 'custom' : currentPreset);

	function choosePreset(next: Preset): void {
		customMode = next === 'custom';
		journal.setFilter(rangeFor(next));
	}

	const symbols = $derived(
		[...new Set(journal.trades.map((t) => t.underlying))]
			.sort()
			.map((s) => ({ value: s, label: s }))
	);
	const strategies = $derived(
		[...new Set(journal.views.map((v) => v.metrics.strategy))]
			.sort((a, b) => STRATEGIES[a].label.localeCompare(STRATEGIES[b].label))
			.map((s) => ({ value: s, label: STRATEGIES[s].label }))
	);
	const accounts = $derived(journal.accounts.map((a) => ({ value: a.id, label: a.name })));
	const tags = $derived(journal.tags.map((t) => ({ value: t.id, label: t.name, color: t.color })));
	const active = $derived(isFilterActive(journal.filter));
</script>

<div class="filters" role="search" aria-label="Filter trades">
	<span class="icon" aria-hidden="true"><FunnelSimpleIcon size={16} /></span>
	<div class="preset">
		<Select
			aria-label="Date range"
			value={preset}
			options={PRESETS}
			onchange={(e: Event & { currentTarget: HTMLSelectElement }) =>
				choosePreset(e.currentTarget.value as Preset)}
		/>
	</div>
	{#if preset === 'custom'}
		<label class="date">
			<span class="visually-hidden">From</span>
			<input
				type="date"
				value={journal.filter.from ?? ''}
				max={journal.filter.to ?? today}
				onchange={(e) => journal.setFilter({ from: e.currentTarget.value || null })}
			/>
		</label>
		<span class="to" aria-hidden="true">to</span>
		<label class="date">
			<span class="visually-hidden">To</span>
			<input
				type="date"
				value={journal.filter.to ?? ''}
				min={journal.filter.from ?? undefined}
				onchange={(e) => journal.setFilter({ to: e.currentTarget.value || null })}
			/>
		</label>
	{/if}
	{#if accounts.length > 1}
		<MultiSelect
			label="Accounts"
			placeholder="All accounts"
			options={accounts}
			values={[...journal.filter.accountIds]}
			onchange={(v) => journal.setFilter({ accountIds: v })}
		/>
	{/if}
	<MultiSelect
		label="Symbols"
		placeholder="All symbols"
		searchable
		options={symbols}
		values={[...journal.filter.symbols]}
		onchange={(v) => journal.setFilter({ symbols: v })}
	/>
	<MultiSelect
		label="Strategies"
		placeholder="All strategies"
		options={strategies}
		values={[...journal.filter.strategies]}
		onchange={(v) => journal.setFilter({ strategies: v as StrategyKind[] })}
	/>
	{#if tags.length > 0}
		<MultiSelect
			label="Tags"
			placeholder="All tags"
			searchable
			options={tags}
			values={[...journal.filter.tagIds]}
			onchange={(v) => journal.setFilter({ tagIds: v })}
		/>
	{/if}
	{#if active}
		<button
			type="button"
			class="reset"
			onclick={() => {
				customMode = false;
				journal.resetFilter();
			}}>Clear filters</button
		>
	{/if}
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.icon {
		display: inline-flex;
		color: var(--color-ink-3);
	}

	.preset :global(select) {
		min-height: 32px;
		font-size: var(--text-sm);
		min-width: 150px;
	}

	.date input {
		height: 32px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		font-size: var(--text-sm);
		color-scheme: inherit;
	}

	.to {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.reset {
		height: 32px;
		padding: 0 var(--space-2);
		border: 0;
		background: transparent;
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.reset:hover {
		color: var(--color-ink);
	}
</style>
