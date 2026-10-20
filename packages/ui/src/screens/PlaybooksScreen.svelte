<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import {
		EMPTY_FILTER,
		formatMoney,
		formatPercent,
		formatR,
		formatRatio,
		groupBy,
		newId,
		PlaybookSchema,
		type GroupStats,
		type Playbook
	} from '@journalix/core';
	import * as v from 'valibot';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import IconButton from '../primitives/IconButton.svelte';
	import Dialog from '../primitives/Dialog.svelte';
	import ConfirmDialog from '../primitives/ConfirmDialog.svelte';
	import Field from '../primitives/Field.svelte';
	import TextInput from '../primitives/TextInput.svelte';
	import Textarea from '../primitives/Textarea.svelte';
	import Switch from '../primitives/Switch.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import Badge from '../primitives/Badge.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Pnl from './parts/Pnl.svelte';
	import ColorSwatches, { SWATCHES } from './parts/ColorSwatches.svelte';

	const { journal, env, toaster } = useApp();
	const currency = $derived(journal.settings.baseCurrency);

	// Playbook performance is lifetime, independent of the global filter bar.
	const stats = $derived.by(() => {
		const rows = groupBy(journal.views, 'playbook', {
			timeZone: journal.settings.timeZone,
			playbookNames: new Map(journal.playbooks.map((p) => [p.id, p.name])),
			tagNames: new Map()
		});
		return new Map<string, GroupStats>(rows.map((r) => [r.key, r]));
	});
	const openCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const view of journal.views) {
			if (view.metrics.status === 'open' && view.trade.playbookId) {
				counts.set(view.trade.playbookId, (counts.get(view.trade.playbookId) ?? 0) + 1);
			}
		}
		return counts;
	});

	let show = $state<'active' | 'archived'>('active');
	const visible = $derived(
		journal.playbooks
			.filter((p) => (show === 'archived' ? p.archived : !p.archived))
			.sort(
				(a, b) =>
					(stats.get(b.id)?.netPnl ?? 0) - (stats.get(a.id)?.netPnl ?? 0) ||
					a.name.localeCompare(b.name)
			)
	);
	const archivedCount = $derived(journal.playbooks.filter((p) => p.archived).length);

	// ----- editor -----
	interface Draft {
		id: string;
		name: string;
		description: string;
		rules: string;
		color: string;
		archived: boolean;
		createdAt: string;
	}

	let editorOpen = $state(false);
	let draft = $state<Draft>(blank());
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);
	const isNew = $derived(!journal.playbookById.has(draft.id));

	function blank(): Draft {
		const used = new Set(journal.playbooks.map((p) => p.color));
		const color =
			SWATCHES.find((s) => !used.has(s.value))?.value ?? SWATCHES[0]?.value ?? '#3778c8';
		return {
			id: newId(),
			name: '',
			description: '',
			rules: '',
			color,
			archived: false,
			createdAt: new Date().toISOString()
		};
	}

	function create(): void {
		draft = blank();
		errors = {};
		editorOpen = true;
	}

	function edit(p: Playbook): void {
		draft = { ...p, rules: p.rules.join('\n') };
		errors = {};
		editorOpen = true;
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const candidate = {
			id: draft.id,
			name: draft.name,
			description: draft.description,
			rules: draft.rules
				.split('\n')
				.map((r) => r.trim())
				.filter(Boolean),
			color: draft.color,
			archived: draft.archived,
			createdAt: draft.createdAt
		};
		const parsed = v.safeParse(PlaybookSchema, candidate);
		if (!parsed.success) {
			const next: Record<string, string> = {};
			for (const issue of parsed.issues) {
				const key = String(issue.path?.[0]?.key ?? 'form');
				next[key] ??= issue.message;
			}
			errors = next;
			return;
		}
		saving = true;
		try {
			await journal.savePlaybook(parsed.output);
			toaster.success(isNew ? 'Playbook created' : 'Playbook saved');
			editorOpen = false;
		} catch (error) {
			toaster.error(
				'Could not save the playbook',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			saving = false;
		}
	}

	let pendingDelete = $state<Playbook | null>(null);
	let confirmOpen = $state(false);

	function askDelete(p: Playbook): void {
		pendingDelete = p;
		confirmOpen = true;
	}

	async function remove(): Promise<void> {
		const target = pendingDelete;
		if (!target) return;
		try {
			await journal.deletePlaybook(target.id);
			toaster.success(`Deleted ${target.name}`);
		} catch (error) {
			toaster.error(
				'Could not delete the playbook',
				error instanceof Error ? error.message : undefined
			);
		}
	}

	function viewTrades(id: string): void {
		journal.setFilter({ ...EMPTY_FILTER, playbookIds: [id] });
		void env.navigate({ name: 'trades' });
	}
</script>

<PageHeader
	title="Playbooks"
	description="Name the setups you trade, write their rules, and see which ones pay."
>
	{#snippet actions()}
		<Button variant="primary" onclick={create}>
			{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
			New playbook
		</Button>
	{/snippet}
</PageHeader>

{#if journal.playbooks.length === 0}
	<EmptyState
		title="No playbooks yet"
		message="A playbook is a setup you trade on purpose, such as an opening-range breakout or a 45-day put credit spread. Assign it to trades to compare setups."
	>
		{#snippet actions()}<Button variant="primary" onclick={create}>New playbook</Button>{/snippet}
	</EmptyState>
{:else}
	{#if archivedCount > 0}
		<div class="toolbar">
			<Segmented
				label="Show"
				bind:value={show}
				options={[
					{ value: 'active', label: 'Active' },
					{ value: 'archived', label: `Archived (${archivedCount})` }
				]}
			/>
		</div>
	{/if}

	<ul class="grid" role="list">
		{#each visible as p (p.id)}
			{@const s = stats.get(p.id)}
			<li class="card" style:--identity={p.color}>
				<header>
					<h2>{p.name}</h2>
					<div class="card-actions">
						<IconButton label="Edit {p.name}" size="sm" onclick={() => edit(p)}
							><PencilSimpleIcon size={16} /></IconButton
						>
						<IconButton label="Delete {p.name}" size="sm" tone="danger" onclick={() => askDelete(p)}
							><TrashIcon size={16} /></IconButton
						>
					</div>
				</header>
				{#if p.description}<p class="description">{p.description}</p>{/if}

				<dl class="stats">
					<div>
						<dt>Net P&L</dt>
						<dd>
							{#if s}<Pnl value={s.netPnl} {currency} />{:else}<span class="muted">—</span>{/if}
						</dd>
					</div>
					<div>
						<dt>Closed trades</dt>
						<dd class="num">{s?.trades ?? 0}</dd>
					</div>
					<div>
						<dt>Win rate</dt>
						<dd class="num">{formatPercent(s?.winRate ?? null)}</dd>
					</div>
					<div>
						<dt>Profit factor</dt>
						<dd class="num">
							{formatRatio(s?.profitFactor ?? null, 2, (s?.grossProfit ?? 0) > 0)}
						</dd>
					</div>
					<div>
						<dt>Average R</dt>
						<dd class="num">{formatR(s?.averageR ?? null)}</dd>
					</div>
					<div>
						<dt>Average trade</dt>
						<dd class="num">{s ? formatMoney(s.averagePnl, { currency, signed: true }) : '—'}</dd>
					</div>
				</dl>

				{#if p.rules.length}
					<details>
						<summary>{p.rules.length} {p.rules.length === 1 ? 'rule' : 'rules'}</summary>
						<ol class="rules">
							{#each p.rules as rule, i (i)}<li>{rule}</li>{/each}
						</ol>
					</details>
				{/if}

				<footer>
					{#if openCounts.get(p.id)}<Badge tone="signal">{openCounts.get(p.id)} open</Badge>{/if}
					{#if p.archived}<Badge tone="outline">Archived</Badge>{/if}
					<Button size="sm" variant="ghost" onclick={() => viewTrades(p.id)}>View trades</Button>
				</footer>
			</li>
		{/each}
	</ul>
{/if}

<Dialog
	bind:open={editorOpen}
	title={isNew ? 'New playbook' : `Edit ${journal.playbookById.get(draft.id)?.name ?? 'playbook'}`}
	size="md"
>
	<form id="playbook-form" class="form" onsubmit={save} novalidate>
		<Field label="Name" for="pb-name" error={errors['name']}>
			<TextInput
				id="pb-name"
				bind:value={draft.name}
				invalid={!!errors['name']}
				maxlength={120}
				required
			/>
		</Field>
		<Field
			label="Description"
			for="pb-description"
			optional
			help="When you take this trade and why it works."
		>
			<Textarea id="pb-description" bind:value={draft.description} rows={3} />
		</Field>
		<Field
			label="Rules"
			for="pb-rules"
			optional
			help="One rule per line: entry trigger, stop placement, sizing, exit."
			error={errors['rules']}
		>
			<Textarea id="pb-rules" bind:value={draft.rules} rows={6} invalid={!!errors['rules']} />
		</Field>
		<ColorSwatches label="Colour" name="pb-color" bind:value={draft.color} />
		{#if !isNew}<Switch id="pb-archived" label="Archived" bind:checked={draft.archived} />{/if}
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (editorOpen = false)}>Cancel</Button>
		<Button type="submit" form="playbook-form" variant="primary" busy={saving}
			>{isNew ? 'Create playbook' : 'Save playbook'}</Button
		>
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete {pendingDelete?.name ?? 'playbook'}?"
	message="Trades keep their fills but lose this playbook. To keep its history in reports, archive it instead."
	confirmLabel="Delete playbook"
	tone="danger"
	onconfirm={remove}
/>

<style>
	.toolbar {
		margin-bottom: var(--space-5);
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: var(--space-5);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-5);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-top: 3px solid var(--identity);
		border-radius: var(--radius-md);
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	h2 {
		font-size: var(--text-lg);
		overflow-wrap: anywhere;
	}

	.card-actions {
		display: flex;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.description {
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		white-space: pre-wrap;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}

	dt {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	dd {
		margin: 0;
	}

	details summary {
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--color-ink-2);
	}

	.rules {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-5);
		display: grid;
		gap: var(--space-1);
		font-size: var(--text-sm);
	}

	footer {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	footer :global(:last-child) {
		margin-left: auto;
	}

	.form {
		display: grid;
		gap: var(--space-4);
	}
</style>
