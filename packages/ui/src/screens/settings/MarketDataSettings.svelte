<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import {
		formatDateTime,
		type ProviderConfigView,
		type ProviderTestResult
	} from '@strikebook/core';
	import { PROVIDERS } from '@strikebook/core/market-data';
	import { SvelteMap } from 'svelte/reactivity';
	import { useApp } from '../../app/context.ts';
	import Button from '../../primitives/Button.svelte';
	import Badge from '../../primitives/Badge.svelte';
	import Panel from '../../primitives/Panel.svelte';
	import EmptyState from '../../primitives/EmptyState.svelte';
	import ConfirmDialog from '../../primitives/ConfirmDialog.svelte';
	import ProviderDialog from './ProviderDialog.svelte';

	const { journal, repo, toaster, env } = useApp();

	let dialogOpen = $state(false);
	let editing = $state<ProviderConfigView | null>(null);
	const results = new SvelteMap<string, ProviderTestResult & { at: number }>();
	const testing = new SvelteMap<string, boolean>();

	function add(): void {
		editing = null;
		dialogOpen = true;
	}

	function edit(view: ProviderConfigView): void {
		editing = view;
		dialogOpen = true;
	}

	async function test(view: ProviderConfigView): Promise<void> {
		testing.set(view.id, true);
		try {
			const result = await repo.providers.test(view.id);
			results.set(view.id, { ...result, at: Date.now() });
		} catch (error) {
			results.set(view.id, {
				ok: false,
				message: error instanceof Error ? error.message : 'The test request failed',
				at: Date.now()
			});
		} finally {
			testing.delete(view.id);
		}
	}

	async function makeDefault(view: ProviderConfigView): Promise<void> {
		try {
			await journal.saveProvider({
				id: view.id,
				provider: view.provider,
				label: view.label,
				options: view.options,
				isDefault: true,
				secret: null
			});
			toaster.success(`${view.label} is now the default`);
		} catch (error) {
			toaster.error(
				'Could not change the default',
				error instanceof Error ? error.message : undefined
			);
		}
	}

	let pendingDelete = $state<ProviderConfigView | null>(null);
	let confirmOpen = $state(false);

	async function remove(): Promise<void> {
		const target = pendingDelete;
		if (!target) return;
		try {
			await journal.deleteProvider(target.id);
			results.delete(target.id);
			toaster.success(`Removed ${target.label}`);
		} catch (error) {
			toaster.error(
				'Could not remove the provider',
				error instanceof Error ? error.message : undefined
			);
		}
	}

	const where = $derived(
		env.platform === 'desktop' ? 'in your system keychain' : 'encrypted on the server'
	);
</script>

<div class="stack">
	<Panel
		title="Market data providers"
		subtitle="Bring your own API key from any supported provider. Candles are fetched only when you open a trade, then cached."
	>
		{#snippet actions()}
			<Button variant="primary" size="sm" onclick={add}>
				{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
				Add provider
			</Button>
		{/snippet}

		{#if journal.providers.length === 0}
			<EmptyState
				title="No provider connected"
				message="Trade charts need candles. Add a key from Massive, Alpaca, Databento or Tiingo, or add the simulator to try charts with generated prices."
			>
				{#snippet actions()}<Button variant="primary" onclick={add}>Add provider</Button>{/snippet}
			</EmptyState>
		{:else}
			<ul class="list" role="list">
				{#each journal.providers as view (view.id)}
					{@const info = PROVIDERS[view.provider]}
					{@const result = results.get(view.id)}
					<li class="item">
						<div class="head">
							<div class="title">
								<h3>{view.label}</h3>
								{#if view.isDefault}<Badge tone="signal">Default</Badge>{/if}
								{#if view.provider === 'simulated'}<Badge tone="outline">Generated prices</Badge
									>{/if}
							</div>
							<div class="actions">
								<Button size="sm" busy={testing.get(view.id) ?? false} onclick={() => test(view)}
									>Test</Button
								>
								<Button size="sm" variant="ghost" onclick={() => edit(view)}>Edit</Button>
								{#if !view.isDefault}<Button
										size="sm"
										variant="ghost"
										onclick={() => makeDefault(view)}>Make default</Button
									>{/if}
								<Button
									size="sm"
									variant="ghost"
									onclick={() => {
										pendingDelete = view;
										confirmOpen = true;
									}}>Remove</Button
								>
							</div>
						</div>
						<dl class="meta">
							<div>
								<dt>Provider</dt>
								<dd>{info.name}</dd>
							</div>
							<div>
								<dt>Coverage</dt>
								<dd>{info.supportsOptions ? 'Stocks and options' : 'Stocks'}</dd>
							</div>
							{#if info.fields.some((f) => f.kind === 'secret')}
								<div>
									<dt>Key</dt>
									<dd class="mono">{view.secretHint ?? 'Not set'}</dd>
								</div>
							{/if}
							{#each info.fields.filter((f) => f.kind !== 'secret' && view.options[f.name]) as f (f.name)}
								<div>
									<dt>{f.label}</dt>
									<dd>
										{f.choices?.find((c) => c.value === view.options[f.name])?.label ??
											view.options[f.name]}
									</dd>
								</div>
							{/each}
							<div>
								<dt>Updated</dt>
								<dd>{formatDateTime(view.updatedAt, journal.settings.timeZone)}</dd>
							</div>
						</dl>
						{#if result}
							<p class="result" class:ok={result.ok} role="status">
								{#if result.ok}<CheckCircleIcon
										size={16}
										weight="fill"
										aria-hidden="true"
									/>{:else}<WarningCircleIcon size={16} weight="fill" aria-hidden="true" />{/if}
								<span>{result.ok ? 'Connected.' : 'Test failed.'} {result.message}</span>
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>

	<Panel title="How keys are handled">
		<ul class="facts">
			<li>
				Keys are stored {where} and are never sent back to this screen. Only the last characters are shown
				so you can tell keys apart.
			</li>
			<li>
				Requests go straight from {env.platform === 'desktop'
					? 'this app'
					: 'the Strikebook server'} to the provider. Nothing is shared with anyone else.
			</li>
			<li>
				Bars are cached per provider, so reopening a trade does not use your quota again. Changing a
				provider's options clears its cache.
			</li>
			<li>
				Providers bill and rate-limit on their own terms. Check your plan covers the data you
				request, especially options history.
			</li>
		</ul>
	</Panel>
</div>

<ProviderDialog bind:open={dialogOpen} {editing} onsaved={(view) => void test(view)} />

<ConfirmDialog
	bind:open={confirmOpen}
	title="Remove {pendingDelete?.label ?? 'provider'}?"
	message="Its stored key and cached bars are deleted. Trades are not affected."
	confirmLabel="Remove provider"
	tone="danger"
	onconfirm={remove}
/>

<style>
	.stack {
		display: grid;
		gap: var(--space-5);
	}

	.list {
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}

	.item {
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		display: grid;
		gap: var(--space-3);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	h3 {
		font-size: var(--text-md);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-6);
		font-size: var(--text-sm);
	}

	dt {
		color: var(--color-ink-3);
		font-size: var(--text-xs);
	}

	dd {
		margin: 0;
	}

	.result {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-loss);
	}

	.result.ok {
		color: var(--color-gain);
	}

	.result :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.result span {
		color: var(--color-ink);
	}

	.facts {
		margin: 0;
		padding-left: var(--space-5);
		display: grid;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-ink-2);
		max-width: var(--prose-max);
	}
</style>
