<script lang="ts">
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import Panel from '../../primitives/Panel.svelte';
	import Button from '../../primitives/Button.svelte';
	import IconButton from '../../primitives/IconButton.svelte';
	import NumberInput from '../../primitives/NumberInput.svelte';
	import '../../primitives/control.css';
	import type { TradeDraft } from './draft.svelte.ts';

	interface Props {
		draft: TradeDraft;
		issues: ReadonlyMap<string, string>;
	}

	let { draft, issues }: Props = $props();
	const onUnderlying = $derived(draft.legs.some((l) => l.kind === 'call' || l.kind === 'put'));
	const sorted = $derived(
		[...draft.levels].sort((a, b) => a.setAt.localeCompare(b.setAt) || a.kind.localeCompare(b.kind))
	);
</script>

<Panel
	title="Stops and targets"
	subtitle={onUnderlying
		? 'Levels on the underlying price. Add a new row each time you move one; the history is kept.'
		: 'Add a new row each time you move one; the history is kept.'}
>
	{#if draft.levels.length > 0}
		<div class="rows" role="list">
			{#each sorted as level (level.id)}
				<div class="row {level.kind}" role="listitem">
					<span class="kind">{level.kind === 'stop' ? 'Stop' : 'Target'}</span>
					<label>
						<span>Price</span>
						<NumberInput
							bind:value={level.price}
							min="0"
							invalid={issues.has(`level:${level.id}:price`)}
							aria-label="{level.kind} price"
						/>
					</label>
					<label class="when">
						<span>Set at</span>
						<input
							type="datetime-local"
							class="control"
							bind:value={level.setAt}
							aria-label="{level.kind} set at"
						/>
					</label>
					<label class="note">
						<span>Note</span>
						<input type="text" class="control" bind:value={level.note} maxlength="1000" />
					</label>
					<IconButton
						label="Remove {level.kind}"
						tone="danger"
						onclick={() => draft.removeLevel(level.id)}><TrashIcon size={16} /></IconButton
					>
				</div>
			{/each}
		</div>
	{/if}
	<div class="actions">
		<Button size="sm" onclick={() => draft.addLevel('stop')}
			>{draft.levels.some((l) => l.kind === 'stop') ? 'Move stop' : 'Add stop'}</Button
		>
		<Button size="sm" onclick={() => draft.addLevel('target')}
			>{draft.levels.some((l) => l.kind === 'target') ? 'Move target' : 'Add target'}</Button
		>
	</div>
</Panel>

<style>
	.rows {
		display: grid;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.row {
		display: grid;
		grid-template-columns: 64px minmax(100px, 140px) minmax(210px, 240px) minmax(120px, 1fr) auto;
		align-items: end;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-left: 2px solid var(--color-line-strong);
		background: var(--color-surface-2);
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
	}

	.stop {
		border-left-color: var(--color-loss);
	}

	.target {
		border-left-color: var(--color-gain);
	}

	.kind {
		align-self: center;
		font-weight: 600;
		font-size: var(--text-sm);
	}

	label {
		display: grid;
		gap: 4px;
		font-size: var(--text-xs);
		color: var(--color-ink-3);
		min-width: 0;
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}

	@media (max-width: 720px) {
		.row {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}

		/* The date-time input is about 210px wide, more than half a phone: it gets a row of its own. */
		.kind,
		.when,
		.note {
			grid-column: 1 / -1;
		}
	}
</style>
