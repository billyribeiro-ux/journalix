<script lang="ts">
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { describeContract, formatOcc, type LegKind } from '@journalix/core';
	import Panel from '../../primitives/Panel.svelte';
	import Button from '../../primitives/Button.svelte';
	import IconButton from '../../primitives/IconButton.svelte';
	import NumberInput from '../../primitives/NumberInput.svelte';
	import Select from '../../primitives/Select.svelte';
	import {
		STRUCTURE_PRESETS,
		defaultMultiplier,
		type StructurePreset,
		type TradeDraft
	} from './draft.svelte.ts';

	interface Props {
		draft: TradeDraft;
		issues: ReadonlyMap<string, string>;
	}

	let { draft, issues }: Props = $props();

	const options = $derived(draft.assetClass === 'option');
	const kinds: readonly { value: LegKind; label: string }[] = [
		{ value: 'call', label: 'Call' },
		{ value: 'put', label: 'Put' },
		{ value: 'stock', label: 'Shares' }
	];

	let preset = $state<StructurePreset>('single');
	let centre = $state<number | null>(null);
	let width = $state<number | null>(5);
	let presetExpiry = $state('');

	function occFor(index: number): { label: string; code: string } | null {
		const leg = draft.legs[index];
		const symbol = draft.underlying.trim().toUpperCase();
		if (
			!leg ||
			(leg.kind !== 'call' && leg.kind !== 'put') ||
			leg.strike === null ||
			!leg.expiration ||
			!symbol ||
			symbol.length > 6
		)
			return null;
		try {
			const ref = {
				underlying: symbol,
				expiration: leg.expiration,
				kind: leg.kind,
				strike: leg.strike
			};
			return { label: describeContract(ref), code: formatOcc(ref) };
		} catch {
			return null;
		}
	}

	function setKind(index: number, kind: LegKind): void {
		const leg = draft.legs[index];
		if (!leg) return;
		leg.kind = kind;
		leg.multiplier = defaultMultiplier(kind);
		if (kind === 'stock') {
			leg.strike = null;
			leg.expiration = '';
		}
	}
</script>

<Panel
	title={options ? 'Legs' : 'Instrument'}
	subtitle={options
		? 'One row per contract. Strategy is detected from the legs and your opening fills.'
		: undefined}
>
	{#if options}
		<details class="preset">
			<summary>Start from a structure</summary>
			<div class="preset-grid">
				<label>
					<span>Structure</span>
					<Select bind:value={preset} options={STRUCTURE_PRESETS} aria-label="Structure" />
				</label>
				<label>
					<span>Centre strike</span>
					<NumberInput bind:value={centre} min="0" aria-label="Centre strike" />
				</label>
				<label>
					<span>Strike width</span>
					<NumberInput bind:value={width} min="0" aria-label="Strike width" />
				</label>
				<label>
					<span>Expiration</span>
					<input class="date" type="date" bind:value={presetExpiry} aria-label="Expiration" />
				</label>
				<Button
					size="sm"
					onclick={() => draft.applyPreset(preset, centre, presetExpiry, width ?? 5)}
					>Use structure</Button
				>
			</div>
			<p class="hint">
				Replaces the current legs and fills. Set each leg’s side when you add the opening fill.
			</p>
		</details>
	{/if}

	<div class="legs" role="list">
		{#each draft.legs as leg, index (leg.id)}
			{@const occ = occFor(index)}
			<div class="leg" role="listitem">
				<span class="n num" aria-hidden="true">{index + 1}</span>
				{#if options}
					<label class="kind">
						<span class="visually-hidden">Leg {index + 1} type</span>
						<Select
							value={leg.kind}
							options={kinds}
							onchange={(e: Event & { currentTarget: HTMLSelectElement }) =>
								setKind(index, e.currentTarget.value as LegKind)}
						/>
					</label>
					{#if leg.kind !== 'stock'}
						<label>
							<span class="lbl">Strike</span>
							<NumberInput
								bind:value={leg.strike}
								min="0"
								invalid={issues.has(`leg:${leg.id}:`)}
								aria-label="Leg {index + 1} strike"
							/>
						</label>
						<label>
							<span class="lbl">Expiration</span>
							<input
								class="date"
								type="date"
								bind:value={leg.expiration}
								aria-label="Leg {index + 1} expiration"
								aria-invalid={issues.has(`leg:${leg.id}:`) || undefined}
							/>
						</label>
					{:else}
						<span class="note">Shares of {draft.underlying || 'the underlying'}</span>
					{/if}
				{:else}
					<span class="note"
						>{draft.assetClass === 'future'
							? 'Futures contract'
							: draft.assetClass === 'stock'
								? 'Shares'
								: 'Units'} of {draft.underlying || 'the symbol'}</span
					>
				{/if}
				<label class="mult">
					<span class="lbl">Multiplier</span>
					<NumberInput
						bind:value={leg.multiplier}
						min="0"
						aria-label="Leg {index + 1} multiplier"
					/>
				</label>
				{#if options && draft.legs.length > 1}
					<IconButton
						label="Remove leg {index + 1}"
						tone="danger"
						onclick={() => draft.removeLeg(leg.id)}><TrashIcon size={16} /></IconButton
					>
				{/if}
				{#if occ}<p class="occ"><span>{occ.label}</span> <code>{occ.code}</code></p>{/if}
				{#if issues.get(`leg:${leg.id}:`)}<p class="err" role="alert">
						{issues.get(`leg:${leg.id}:`)}
					</p>{/if}
			</div>
		{/each}
	</div>

	{#if options}
		<div class="actions">
			<Button size="sm" onclick={() => draft.addLeg('call')}>
				{#snippet icon()}<PlusIcon size={14} />{/snippet}
				Add leg
			</Button>
		</div>
	{/if}
</Panel>

<style>
	.preset {
		margin-bottom: var(--space-4);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
	}

	summary {
		cursor: pointer;
		font-weight: 500;
		font-size: var(--text-sm);
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		align-items: end;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}

	.preset-grid label,
	.leg label {
		display: grid;
		gap: 4px;
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	.hint {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	.legs {
		display: grid;
		gap: var(--space-3);
	}

	.leg {
		display: grid;
		grid-template-columns: 24px repeat(auto-fit, minmax(120px, 1fr));
		align-items: end;
		gap: var(--space-3);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	.n {
		align-self: center;
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.lbl {
		color: var(--color-ink-3);
	}

	.kind {
		align-self: end;
	}

	.date {
		min-height: 36px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		width: 100%;
	}

	.date[aria-invalid='true'] {
		border-color: var(--color-loss);
	}

	.note {
		align-self: center;
		color: var(--color-ink-2);
		font-size: var(--text-sm);
	}

	.occ {
		grid-column: 2 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		font-size: var(--text-xs);
		color: var(--color-ink-2);
	}

	.occ code {
		font-family: var(--font-mono);
		white-space: pre;
		color: var(--color-ink-3);
	}

	.err {
		grid-column: 2 / -1;
		font-size: var(--text-xs);
		color: var(--color-loss);
	}

	.actions {
		margin-top: var(--space-3);
	}
</style>
