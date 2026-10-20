<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import {
		EMPTY_FILTER,
		formatPercent,
		formatR,
		groupBy,
		newId,
		TagSchema,
		type GroupStats,
		type Tag,
		type TagCategory
	} from '@strikebook/core';
	import * as v from 'valibot';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import IconButton from '../primitives/IconButton.svelte';
	import Dialog from '../primitives/Dialog.svelte';
	import ConfirmDialog from '../primitives/ConfirmDialog.svelte';
	import Field from '../primitives/Field.svelte';
	import TextInput from '../primitives/TextInput.svelte';
	import Select from '../primitives/Select.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import Panel from '../primitives/Panel.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Pnl from './parts/Pnl.svelte';
	import ColorSwatches, { SWATCHES } from './parts/ColorSwatches.svelte';

	const CATEGORIES: readonly { value: TagCategory; label: string; help: string }[] = [
		{ value: 'setup', label: 'Setups', help: 'Why you took the trade.' },
		{ value: 'mistake', label: 'Mistakes', help: 'Rules you broke. Reports total what they cost.' },
		{ value: 'emotion', label: 'Emotions', help: 'How you felt going in or getting out.' },
		{
			value: 'market',
			label: 'Market conditions',
			help: 'Trend, range, news day, high volatility.'
		},
		{ value: 'custom', label: 'Other', help: 'Anything else you want to slice results by.' }
	];

	const { journal, env, toaster } = useApp();
	const currency = $derived(journal.settings.baseCurrency);

	const stats = $derived.by(() => {
		const rows = groupBy(journal.views, 'tag', {
			timeZone: journal.settings.timeZone,
			playbookNames: new Map(),
			tagNames: new Map(journal.tags.map((t) => [t.id, t.name]))
		});
		return new Map<string, GroupStats>(rows.map((r) => [r.key, r]));
	});
	const usage = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const t of journal.trades)
			for (const id of t.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
		return counts;
	});
	const grouped = $derived(
		CATEGORIES.map((c) => ({
			...c,
			tags: journal.tags
				.filter((t) => t.category === c.value)
				.sort((a, b) => a.name.localeCompare(b.name))
		}))
	);

	let editorOpen = $state(false);
	let draft = $state<Tag>(blank('setup'));
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);
	const isNew = $derived(!journal.tagById.has(draft.id));

	function blank(category: TagCategory): Tag {
		const color =
			category === 'mistake'
				? '#ba5530'
				: category === 'emotion'
					? '#8b5fb9'
					: (SWATCHES[0]?.value ?? '#3778c8');
		return { id: newId(), name: '', category, color };
	}

	function create(category: TagCategory = 'setup'): void {
		draft = blank(category);
		errors = {};
		editorOpen = true;
	}

	function edit(tag: Tag): void {
		draft = { ...tag };
		errors = {};
		editorOpen = true;
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const parsed = v.safeParse(TagSchema, draft);
		if (!parsed.success) {
			const next: Record<string, string> = {};
			for (const issue of parsed.issues)
				next[String(issue.path?.[0]?.key ?? 'form')] ??= issue.message;
			errors = next;
			return;
		}
		const duplicate = journal.tags.find(
			(t) =>
				t.id !== parsed.output.id &&
				t.category === parsed.output.category &&
				t.name.toLowerCase() === parsed.output.name.toLowerCase()
		);
		if (duplicate) {
			errors = { name: 'A tag with this name already exists in this category' };
			return;
		}
		saving = true;
		try {
			await journal.saveTag(parsed.output);
			toaster.success(isNew ? 'Tag created' : 'Tag saved');
			editorOpen = false;
		} catch (error) {
			toaster.error('Could not save the tag', error instanceof Error ? error.message : undefined);
		} finally {
			saving = false;
		}
	}

	let pendingDelete = $state<Tag | null>(null);
	let confirmOpen = $state(false);

	async function remove(): Promise<void> {
		const target = pendingDelete;
		if (!target) return;
		try {
			await journal.deleteTag(target.id);
			toaster.success(`Deleted ${target.name}`);
		} catch (error) {
			toaster.error('Could not delete the tag', error instanceof Error ? error.message : undefined);
		}
	}

	function viewTrades(id: string): void {
		journal.setFilter({ ...EMPTY_FILTER, tagIds: [id] });
		void env.navigate({ name: 'trades' });
	}
</script>

<PageHeader
	title="Tags"
	description="Label trades with setups, mistakes and emotions, then compare results by label."
>
	{#snippet actions()}
		<Button variant="primary" onclick={() => create()}>
			{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
			New tag
		</Button>
	{/snippet}
</PageHeader>

{#if journal.tags.length === 0}
	<EmptyState
		title="No tags yet"
		message="Start with your setups and the mistakes you want to stop making. You can tag trades from the trade editor."
	>
		{#snippet actions()}
			<Button variant="primary" onclick={() => create('setup')}>Add a setup</Button>
			<Button onclick={() => create('mistake')}>Add a mistake</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="categories">
		{#each grouped as group (group.value)}
			<Panel title={group.label} subtitle={group.help} flush>
				{#snippet actions()}
					<Button size="sm" variant="ghost" onclick={() => create(group.value)}>Add</Button>
				{/snippet}
				{#if group.tags.length}
					<table>
						<caption class="visually-hidden">{group.label}</caption>
						<thead>
							<tr>
								<th scope="col">Tag</th>
								<th scope="col" class="num">Trades</th>
								<th scope="col" class="num">Win rate</th>
								<th scope="col" class="num">Avg R</th>
								<th scope="col" class="num">Net P&L</th>
								<th scope="col"><span class="visually-hidden">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each group.tags as tag (tag.id)}
								{@const s = stats.get(tag.id)}
								<tr>
									<th scope="row">
										<button
											type="button"
											class="tag-link"
											onclick={() => viewTrades(tag.id)}
											title="Show trades with this tag"
										>
											<span class="dot" style:background={tag.color} aria-hidden="true"
											></span>{tag.name}
										</button>
									</th>
									<td class="num">{usage.get(tag.id) ?? 0}</td>
									<td class="num">{formatPercent(s?.winRate ?? null)}</td>
									<td class="num">{formatR(s?.averageR ?? null)}</td>
									<td class="num"
										>{#if s}<Pnl value={s.netPnl} {currency} />{:else}<span class="muted">—</span
											>{/if}</td
									>
									<td class="row-actions">
										<IconButton label="Edit {tag.name}" size="sm" onclick={() => edit(tag)}
											><PencilSimpleIcon size={16} /></IconButton
										>
										<IconButton
											label="Delete {tag.name}"
											size="sm"
											tone="danger"
											onclick={() => {
												pendingDelete = tag;
												confirmOpen = true;
											}}><TrashIcon size={16} /></IconButton
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="none">No {group.label.toLowerCase()} yet.</p>
				{/if}
			</Panel>
		{/each}
	</div>
{/if}

<Dialog bind:open={editorOpen} title={isNew ? 'New tag' : 'Edit tag'} size="sm">
	<form id="tag-form" class="form" onsubmit={save} novalidate>
		<Field label="Name" for="tag-name" error={errors['name']}>
			<TextInput
				id="tag-name"
				bind:value={draft.name}
				invalid={!!errors['name']}
				maxlength={60}
				required
			/>
		</Field>
		<Field label="Category" for="tag-category">
			<Select
				id="tag-category"
				bind:value={draft.category}
				options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
			/>
		</Field>
		<ColorSwatches label="Colour" name="tag-color" bind:value={draft.color} />
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (editorOpen = false)}>Cancel</Button>
		<Button type="submit" form="tag-form" variant="primary" busy={saving}
			>{isNew ? 'Create tag' : 'Save tag'}</Button
		>
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete {pendingDelete?.name ?? 'tag'}?"
	message="The tag is removed from {usage.get(pendingDelete?.id ?? '') ??
		0} trades. Their fills and P&L are unchanged."
	confirmLabel="Delete tag"
	tone="danger"
	onconfirm={remove}
/>

<style>
	.categories {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1100px) {
		.categories {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
		}
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th,
	td {
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--color-line);
		text-align: left;
		font-weight: 400;
	}

	thead th {
		color: var(--color-ink-3);
		border-top: 0;
	}

	.num {
		text-align: right;
	}

	.tag-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		border: 0;
		padding: 0;
		background: none;
		color: var(--color-ink);
		font-weight: 500;
		text-align: left;
	}

	.tag-link:hover {
		text-decoration: underline;
	}

	.tag-link:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-pill);
		flex-shrink: 0;
	}

	.row-actions {
		width: 1%;
		white-space: nowrap;
		text-align: right;
	}

	.none {
		padding: var(--space-4);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.form {
		display: grid;
		gap: var(--space-4);
	}
</style>
