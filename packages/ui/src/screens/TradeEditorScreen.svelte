<script lang="ts">
	import { untrack } from 'svelte';
	import {
		newId,
		STRATEGIES,
		STRATEGY_KINDS,
		type AssetClass,
		type StrategyKind
	} from '@journalix/core';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import Field from '../primitives/Field.svelte';
	import TextInput from '../primitives/TextInput.svelte';
	import NumberInput from '../primitives/NumberInput.svelte';
	import Select from '../primitives/Select.svelte';
	import Textarea from '../primitives/Textarea.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import Panel from '../primitives/Panel.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Stars from './parts/Stars.svelte';
	import LegsSection from './editor/LegsSection.svelte';
	import ExecutionsSection from './editor/ExecutionsSection.svelte';
	import LevelsSection from './editor/LevelsSection.svelte';
	import SummaryPanel from './editor/SummaryPanel.svelte';
	import { TradeDraft } from './editor/draft.svelte.ts';

	interface Props {
		/** Edit this trade; omit to create a new one. */
		tradeId?: string;
		/** Pre-fill a new trade from an existing one. */
		duplicateOf?: string;
	}

	let { tradeId, duplicateOf }: Props = $props();

	const { journal, env, toaster } = useApp();

	const sourceId = untrack(() => tradeId ?? duplicateOf ?? null);
	const source = sourceId ? (journal.trades.find((t) => t.id === sourceId) ?? null) : null;
	const editing = untrack(() => tradeId !== undefined);
	const missing = sourceId !== null && source === null;

	const draft = new TradeDraft(journal.settings, source, {
		duplicate: untrack(() => duplicateOf !== undefined),
		accountId: journal.filter.accountIds[0] ?? journal.activeAccounts[0]?.id ?? ''
	});

	let issues = $state<ReadonlyMap<string, string>>(new Map());
	let saving = $state(false);
	let newAccountName = $state('Main account');

	const metrics = $derived(draft.preview());
	const currency = $derived(
		journal.accountById.get(draft.accountId)?.currency ?? journal.settings.baseCurrency
	);

	const ASSET_CLASSES: readonly { value: AssetClass; label: string }[] = [
		{ value: 'option', label: 'Options' },
		{ value: 'stock', label: 'Stock' },
		{ value: 'future', label: 'Futures' },
		{ value: 'crypto', label: 'Crypto' },
		{ value: 'forex', label: 'Forex' }
	];

	const accountOptions = $derived(
		journal.accounts
			.filter((a) => !a.archived || a.id === draft.accountId)
			.map((a) => ({ value: a.id, label: a.name }))
	);
	const playbookOptions = $derived([
		{ value: '', label: 'No playbook' },
		...journal.playbooks
			.filter((p) => !p.archived || p.id === draft.playbookId)
			.map((p) => ({ value: p.id, label: p.name }))
	]);
	const strategyOptions = $derived([
		{
			value: '' as StrategyKind | '',
			label: metrics
				? `Detect automatically (${STRATEGIES[metrics.detectedStrategy].label})`
				: 'Detect automatically'
		},
		...STRATEGY_KINDS.map((k) => ({ value: k as StrategyKind | '', label: STRATEGIES[k].label }))
	]);

	const tagGroups = $derived.by(() => {
		const order = ['setup', 'mistake', 'emotion', 'market', 'custom'] as const;
		const names = {
			setup: 'Setups',
			mistake: 'Mistakes',
			emotion: 'Emotions',
			market: 'Market',
			custom: 'Other'
		} as const;
		return order
			.map((category) => ({
				category,
				label: names[category],
				tags: journal.tags.filter((t) => t.category === category)
			}))
			.filter((g) => g.tags.length > 0);
	});

	function toggleTag(id: string): void {
		draft.tagIds = draft.tagIds.includes(id)
			? draft.tagIds.filter((t) => t !== id)
			: [...draft.tagIds, id];
	}

	async function createAccount(): Promise<void> {
		const name = newAccountName.trim();
		if (!name) return;
		try {
			const account = await journal.saveAccount({
				id: newId(),
				name,
				broker: '',
				currency: journal.settings.baseCurrency,
				startingBalance: 0,
				archived: false,
				createdAt: new Date().toISOString()
			});
			draft.accountId = account.id;
		} catch (error) {
			toaster.error(
				'Could not create the account',
				error instanceof Error ? error.message : undefined
			);
		}
	}

	async function save(): Promise<void> {
		const result = draft.build();
		if (!result.ok) {
			issues = result.issues;
			const first = [...result.issues.entries()][0];
			toaster.error('Check the highlighted fields', first ? first[1] : undefined);
			return;
		}
		issues = new Map();
		saving = true;
		try {
			const saved = await journal.saveTrade(result.trade);
			toaster.success(editing ? 'Trade updated' : 'Trade saved');
			await env.navigate({ name: 'trade', id: saved.id }, { replace: editing });
		} catch (error) {
			toaster.error('Could not save the trade', error instanceof Error ? error.message : undefined);
		} finally {
			saving = false;
		}
	}

	function onkeydown(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			void save();
		}
	}

	const title = editing
		? 'Edit trade'
		: untrack(() => duplicateOf)
			? 'New trade from a copy'
			: 'New trade';
	const cancelHref = $derived(
		editing && tradeId ? env.href({ name: 'trade', id: tradeId }) : env.href({ name: 'trades' })
	);
</script>

<svelte:window {onkeydown} />

{#if missing}
	<EmptyState
		title="Trade not found"
		message="It may have been deleted. Go back to your trades to pick another one."
	>
		{#snippet actions()}<Button href={env.href({ name: 'trades' })}>Back to trades</Button
			>{/snippet}
	</EmptyState>
{:else}
	<PageHeader {title} back={{ href: cancelHref, label: editing ? 'Back to trade' : 'Trades' }}>
		{#snippet actions()}
			<Button href={cancelHref} variant="ghost">Cancel</Button>
			<Button variant="primary" busy={saving} onclick={save}
				>{editing ? 'Save changes' : 'Save trade'}</Button
			>
		{/snippet}
	</PageHeader>

	<form
		class="layout"
		novalidate
		onsubmit={(e) => {
			e.preventDefault();
			void save();
		}}
	>
		<div class="main">
			<Panel title="Trade">
				{#if journal.accounts.length === 0}
					<div class="no-account">
						<p>Trades belong to an account. Create one to continue.</p>
						<div class="inline">
							<TextInput bind:value={newAccountName} aria-label="Account name" />
							<Button onclick={createAccount}>Create account</Button>
						</div>
					</div>
				{/if}
				<div class="grid">
					<Field
						label="Underlying symbol"
						for="underlying"
						error={issues.get('underlying') ?? null}
					>
						<TextInput
							id="underlying"
							bind:value={draft.underlying}
							placeholder="SPY"
							autocomplete="off"
							spellcheck={false}
							style="text-transform: uppercase"
							invalid={issues.has('underlying')}
						/>
					</Field>
					<Field
						label="Account"
						for="account"
						error={issues.get('accountId') ? 'Choose an account' : null}
					>
						<Select
							id="account"
							bind:value={draft.accountId}
							options={accountOptions}
							placeholder="Choose an account"
							invalid={issues.has('accountId')}
						/>
					</Field>
					<div class="asset">
						<span class="label" id="asset-label">Instrument</span>
						<Segmented
							label="Instrument"
							value={draft.assetClass}
							options={ASSET_CLASSES}
							onchange={(v) => draft.setAssetClass(v)}
						/>
					</div>
					<Field label="Playbook" for="playbook" optional>
						<Select id="playbook" bind:value={draft.playbookId} options={playbookOptions} />
					</Field>
					<Field
						label="Strategy"
						for="strategy"
						help="Override only when detection doesn’t match how you think about the trade."
					>
						<Select id="strategy" bind:value={draft.strategy} options={strategyOptions} />
					</Field>
					<Field
						label="Planned risk"
						for="risk"
						optional
						help="Dollar risk at entry. Used for R when set; otherwise R comes from the stop or the structure’s max loss."
					>
						<NumberInput id="risk" bind:value={draft.plannedRisk} min="0" prefix="$" />
					</Field>
				</div>
				{#if tagGroups.length}
					<div class="tags">
						{#each tagGroups as group (group.category)}
							<div class="tag-group">
								<span class="label">{group.label}</span>
								<div class="chips">
									{#each group.tags as tag (tag.id)}
										<button
											type="button"
											class="chip"
											aria-pressed={draft.tagIds.includes(tag.id)}
											onclick={() => toggleTag(tag.id)}
										>
											<span class="dot" style:background={tag.color} aria-hidden="true"></span>
											{tag.name}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Panel>

			<LegsSection {draft} {issues} />
			<ExecutionsSection {draft} {issues} {metrics} />
			<LevelsSection {draft} {issues} />

			<Panel title="Notes and review">
				<div class="notes">
					<Field
						label="Thesis"
						for="thesis"
						help="Why you took the trade, written before or at entry."
					>
						<Textarea id="thesis" bind:value={draft.thesis} rows={3} maxlength={20000} />
					</Field>
					<Field
						label="Review"
						for="review"
						help="What happened, what you did well, what to change."
					>
						<Textarea id="review" bind:value={draft.review} rows={4} maxlength={20000} />
					</Field>
					<div class="ratings">
						<div>
							<span class="label">Execution rating</span>
							<Stars
								label="Execution rating"
								value={draft.rating}
								onchange={(v) => (draft.rating = v)}
							/>
						</div>
						<div>
							<span class="label">Confidence at entry</span>
							<Stars
								label="Confidence at entry"
								value={draft.confidence}
								onchange={(v) => (draft.confidence = v)}
							/>
						</div>
					</div>
				</div>
			</Panel>

			<div class="footer-actions">
				<Button href={cancelHref} variant="ghost">Cancel</Button>
				<Button type="submit" variant="primary" busy={saving}
					>{editing ? 'Save changes' : 'Save trade'}</Button
				>
			</div>
		</div>
		<div class="side">
			<SummaryPanel {metrics} {currency} />
			{#if issues.size > 0}
				<div class="issues" role="alert">
					<h2>Fix before saving</h2>
					<ul>
						{#each [...issues.entries()].slice(0, 8) as [key, message] (key)}
							<li>{message}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</form>
{/if}

<style>
	.layout {
		display: grid;
		gap: var(--space-5);
	}

	.main {
		display: grid;
		gap: var(--space-5);
		min-width: 0;
	}

	.side {
		display: grid;
		gap: var(--space-4);
		align-content: start;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-4);
	}

	.asset {
		display: grid;
		gap: var(--space-1);
		align-content: start;
		grid-column: 1 / -1;
	}

	.asset :global(.segmented) {
		overflow-x: auto;
		max-width: 100%;
	}

	.label {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--color-ink-2);
	}

	.no-account {
		margin-bottom: var(--space-4);
		padding: var(--space-3);
		border: 1px solid var(--color-signal);
		border-radius: var(--radius-sm);
		background: var(--color-signal-soft);
		display: grid;
		gap: var(--space-2);
	}

	.inline {
		display: flex;
		gap: var(--space-2);
	}

	.tags {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.tag-group {
		display: grid;
		gap: var(--space-2);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink-2);
		font-size: var(--text-sm);
	}

	.chip[aria-pressed='true'] {
		border-color: var(--color-ink-2);
		background: var(--color-surface-3);
		color: var(--color-ink);
		font-weight: 500;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.notes {
		display: grid;
		gap: var(--space-4);
	}

	.ratings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-8);
	}

	.ratings > div {
		display: grid;
		gap: var(--space-1);
	}

	.footer-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.issues {
		padding: var(--space-4);
		border: 1px solid color-mix(in oklab, var(--color-loss) 50%, transparent);
		border-radius: var(--radius-md);
		background: var(--color-loss-soft);
	}

	.issues h2 {
		font-size: var(--text-sm);
		margin-bottom: var(--space-2);
	}

	.issues ul {
		margin: 0;
		padding-left: var(--space-4);
		font-size: var(--text-sm);
		color: var(--color-ink-2);
	}

	@media (min-width: 1180px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 320px;
			align-items: start;
		}

		.side {
			position: sticky;
			top: calc(var(--space-6));
		}
	}
</style>
