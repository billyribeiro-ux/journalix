<script lang="ts">
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import {
		classifyExecutions,
		formatPrice,
		type ExecutionKind,
		type Side,
		type TradeMetrics
	} from '@journalix/core';
	import Panel from '../../primitives/Panel.svelte';
	import Button from '../../primitives/Button.svelte';
	import IconButton from '../../primitives/IconButton.svelte';
	import NumberInput from '../../primitives/NumberInput.svelte';
	import Select from '../../primitives/Select.svelte';
	import type { DraftExecution, TradeDraft } from './draft.svelte.ts';

	interface Props {
		draft: TradeDraft;
		issues: ReadonlyMap<string, string>;
		metrics: TradeMetrics | null;
	}

	let { draft, issues, metrics }: Props = $props();

	const multiLeg = $derived(draft.legs.length > 1);
	const hasOptions = $derived(draft.legs.some((l) => l.kind === 'call' || l.kind === 'put'));
	const anyOpen = $derived(metrics?.status === 'open');
	let spreadQty = $state<number | null>(1);

	const SIDES: readonly { value: Side; label: string }[] = [
		{ value: 'buy', label: 'Buy' },
		{ value: 'sell', label: 'Sell' }
	];
	const KINDS: readonly { value: ExecutionKind; label: string }[] = [
		{ value: 'fill', label: 'Fill' },
		{ value: 'expiration', label: 'Expired' },
		{ value: 'assignment', label: 'Assigned' },
		{ value: 'exercise', label: 'Exercised' }
	];

	function legLabel(id: string): string {
		const index = draft.legs.findIndex((l) => l.id === id);
		const leg = draft.legs[index];
		if (!leg) return 'Leg';
		if (leg.kind === 'call' || leg.kind === 'put')
			return `${index + 1}: ${leg.strike === null ? '—' : formatPrice(leg.strike)}${leg.kind === 'call' ? 'C' : 'P'}${leg.expiration ? ` ${leg.expiration.slice(5)}` : ''}`;
		return `${index + 1}: ${leg.kind === 'stock' ? 'Shares' : leg.kind}`;
	}

	const legOptions = $derived(draft.legs.map((l) => ({ value: l.id, label: legLabel(l.id) })));

	/** Role of each saved fill (entry, add, partial, exit) for the row label. */
	const roles = $derived.by(() => {
		const map = new Map<string, string>();
		if (!metrics) return map;
		for (const state of metrics.legs) {
			for (const [id, role] of classifyExecutions(state.leg, state.executions)) {
				map.set(
					id,
					role === 'open'
						? 'Entry'
						: role === 'add'
							? 'Add'
							: role === 'reduce'
								? 'Partial exit'
								: role === 'close'
									? 'Exit'
									: 'Flip'
				);
			}
		}
		return map;
	});

	const sorted = $derived(
		[...draft.executions].sort((a, b) => a.executedAt.localeCompare(b.executedAt))
	);

	function onKindChange(e: DraftExecution, kind: ExecutionKind): void {
		e.kind = kind;
		if (kind === 'expiration') {
			e.price = 0;
			e.fees = 0;
		}
	}
</script>

<Panel
	title="Executions"
	subtitle="Every entry, add, partial and exit as its own fill. Times are in {draft.timeZone}."
>
	{#if draft.executions.length === 0}
		<p class="empty">No fills yet. Add the opening fill to start the trade.</p>
	{:else}
		<div class="rows" role="list">
			{#each sorted as e (e.id)}
				{@const err = (field: string) => issues.get(`exec:${e.id}:${field}`)}
				<div class="row" role="listitem">
					<div class="role">
						<span class="tag">{roles.get(e.id) ?? 'New fill'}</span>
					</div>
					{#if multiLeg}
						<label class="leg">
							<span>Leg</span>
							<Select bind:value={e.legId} options={legOptions} aria-label="Leg" />
						</label>
					{/if}
					<label class="side">
						<span>Side</span>
						<Select bind:value={e.side} options={SIDES} aria-label="Side" />
					</label>
					{#if hasOptions}
						<label class="kind">
							<span>Type</span>
							<Select
								value={e.kind}
								options={KINDS}
								aria-label="Fill type"
								onchange={(ev: Event & { currentTarget: HTMLSelectElement }) =>
									onKindChange(e, ev.currentTarget.value as ExecutionKind)}
							/>
						</label>
					{/if}
					<label>
						<span>Quantity</span>
						<NumberInput
							bind:value={e.quantity}
							min="0"
							invalid={!!err('quantity')}
							aria-label="Quantity"
						/>
					</label>
					<label>
						<span>Price</span>
						<NumberInput
							bind:value={e.price}
							min="0"
							invalid={!!err('price')}
							disabled={e.kind === 'expiration'}
							aria-label="Price"
						/>
					</label>
					<label>
						<span>Fees</span>
						<NumberInput bind:value={e.fees} min="0" prefix="$" aria-label="Fees" />
					</label>
					<label class="time">
						<span>Time</span>
						<input
							type="datetime-local"
							class="dt"
							bind:value={e.executedAt}
							aria-invalid={!!err('executedAt') || undefined}
							aria-label="Execution time"
						/>
					</label>
					{#if hasOptions}
						<label>
							<span>Underlying</span>
							<NumberInput
								bind:value={e.underlyingPrice}
								min="0"
								aria-label="Underlying price at fill"
							/>
						</label>
					{/if}
					<div class="del">
						<IconButton
							label="Remove fill"
							tone="danger"
							onclick={() => draft.removeExecution(e.id)}><TrashIcon size={16} /></IconButton
						>
					</div>
					<label class="note">
						<span class="visually-hidden">Note</span>
						<input
							type="text"
							class="note-input"
							placeholder="Note (optional)"
							bind:value={e.note}
							maxlength="2000"
						/>
					</label>
					{#each ['quantity', 'price', 'executedAt', 'legId', ''] as field (field)}
						{#if err(field)}<p class="err" role="alert">
								{field
									? `${field === 'executedAt' ? 'Time' : field[0]?.toUpperCase() + field.slice(1)}: `
									: ''}{err(field)}
							</p>{/if}
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<div class="actions">
		<Button size="sm" onclick={() => draft.addExecution()}>
			{#snippet icon()}<PlusIcon size={14} />{/snippet}
			Add fill
		</Button>
		{#if multiLeg}
			<span class="spread">
				<NumberInput bind:value={spreadQty} min="0" aria-label="Spread quantity" />
				<Button size="sm" onclick={() => draft.addSpreadFill('open', spreadQty)}
					>Fill all legs to open</Button
				>
				<Button size="sm" onclick={() => draft.addSpreadFill('close', spreadQty)}
					>Fill all legs to close</Button
				>
			</span>
		{/if}
		{#if anyOpen}
			<Button size="sm" variant="ghost" onclick={() => draft.closeRemaining(metrics)}
				>Close remaining</Button
			>
			{#if hasOptions}
				<Button
					size="sm"
					variant="ghost"
					onclick={() => draft.closeRemaining(metrics, 'expiration')}>Expire remaining</Button
				>
			{/if}
		{/if}
	</div>
	{#if hasOptions}
		<p class="hint">
			Enter option prices per share (the premium quote, e.g. 2.35). Recording the underlying price
			at each fill enables IV, Greeks and P&amp;L attribution.
		</p>
	{/if}
</Panel>

<style>
	.empty {
		color: var(--color-ink-3);
		padding: var(--space-2) 0 var(--space-4);
	}

	.rows {
		display: grid;
		gap: var(--space-3);
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
		align-items: end;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
	}

	.role {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tag {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink-2);
	}

	label {
		display: grid;
		gap: 4px;
		font-size: var(--text-xs);
		color: var(--color-ink-3);
		min-width: 0;
	}

	.time {
		grid-column: span 2;
	}

	.dt,
	.note-input {
		min-height: 36px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		width: 100%;
		font-size: var(--text-sm);
	}

	.dt[aria-invalid='true'] {
		border-color: var(--color-loss);
	}

	.del {
		display: flex;
		justify-content: flex-end;
	}

	.note {
		grid-column: 1 / -1;
	}

	.err {
		grid-column: 1 / -1;
		font-size: var(--text-xs);
		color: var(--color-loss);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}

	.spread {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.spread :global(.wrap) {
		width: 72px;
	}

	.hint {
		margin-top: var(--space-3);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
		max-width: var(--prose-max);
	}
</style>
