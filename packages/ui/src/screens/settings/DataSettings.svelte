<script lang="ts">
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { JournalExportSchema, newId, type JournalExport } from '@journalix/core';
	import { createSampleJournal } from '@journalix/core/sample';
	import * as v from 'valibot';
	import { useApp } from '../../app/context.ts';
	import { saveFile } from '../../app/save-file.ts';
	import Button from '../../primitives/Button.svelte';
	import Panel from '../../primitives/Panel.svelte';
	import Dialog from '../../primitives/Dialog.svelte';
	import Field from '../../primitives/Field.svelte';
	import TextInput from '../../primitives/TextInput.svelte';
	import Checkbox from '../../primitives/Checkbox.svelte';

	const { journal, repo, env, toaster } = useApp();

	/** Matches the default request body limit people are likely to hit; the server enforces its own. */
	const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

	// ----- export -----
	let exporting = $state(false);

	async function exportJournal(): Promise<void> {
		exporting = true;
		try {
			const data = await repo.data.exportAll();
			const saved = await saveFile(env, {
				name: `journalix-journal-${data.exportedAt.slice(0, 10)}.json`,
				contents: JSON.stringify(data, null, '\t'),
				mime: 'application/json'
			});
			if (saved)
				toaster.success(
					'Journal exported',
					`${data.trades.length} trades, ${data.notes.length} notes`
				);
		} catch (error) {
			toaster.error(
				'Could not export the journal',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			exporting = false;
		}
	}

	// ----- import -----
	let fileInput = $state<HTMLInputElement | null>(null);
	// The parsed export can hold the whole journal and is only ever replaced, never mutated.
	let pending = $state.raw<{ data: JournalExport; name: string } | null>(null);
	let importOpen = $state(false);
	let importing = $state(false);
	let applySettings = $state(false);

	async function pickFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (file.size > MAX_IMPORT_BYTES) {
			toaster.error(
				'That file is too large',
				'Journal exports over 50 MB cannot be imported here.'
			);
			return;
		}
		let raw: unknown;
		try {
			raw = JSON.parse(await file.text());
		} catch {
			toaster.error(`${file.name} is not valid JSON`);
			return;
		}
		const parsed = v.safeParse(JournalExportSchema, raw);
		if (!parsed.success) {
			const issue = parsed.issues[0];
			const path = issue?.path?.map((p) => String(p.key)).join('.') ?? '';
			toaster.error(
				`${file.name} is not a Journalix export`,
				issue ? `${path ? `${path}: ` : ''}${issue.message}` : undefined
			);
			return;
		}
		pending = { data: parsed.output, name: file.name };
		applySettings = false;
		importOpen = true;
	}

	async function runImport(data: JournalExport, withSettings: boolean): Promise<number> {
		const count = await journal.importJournal(data);
		if (withSettings) await journal.saveSettings(data.settings);
		return count;
	}

	async function confirmImport(): Promise<void> {
		if (!pending) return;
		importing = true;
		try {
			const count = await runImport(pending.data, applySettings);
			toaster.success(
				`Imported ${count} ${count === 1 ? 'trade' : 'trades'}`,
				'Existing items with the same id were updated.'
			);
			importOpen = false;
			pending = null;
		} catch (error) {
			toaster.error(
				'Could not import the journal',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			importing = false;
		}
	}

	// ----- sample -----
	let sampleOpen = $state(false);
	let loadingSample = $state(false);
	let addSimulator = $state(true);
	const hasSimulator = $derived(journal.providers.some((p) => p.provider === 'simulated'));

	async function loadSample(): Promise<void> {
		loadingSample = true;
		try {
			const count = await runImport(createSampleJournal(), false);
			if (addSimulator && !hasSimulator) {
				await journal.saveProvider({
					id: newId(),
					provider: 'simulated',
					label: 'Simulator',
					options: {},
					isDefault: journal.providers.length === 0,
					secret: null
				});
			}
			toaster.success(`Loaded ${count} sample trades`);
			sampleOpen = false;
			await env.navigate({ name: 'dashboard' });
		} catch (error) {
			toaster.error(
				'Could not load the sample journal',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			loadingSample = false;
		}
	}

	// ----- reset -----
	const RESET_PHRASE = 'delete my journal';
	let resetOpen = $state(false);
	let resetText = $state('');
	let resetting = $state(false);

	async function reset(): Promise<void> {
		resetting = true;
		try {
			await journal.resetJournal();
			toaster.success('Journal deleted');
			resetOpen = false;
		} catch (error) {
			toaster.error(
				'Could not delete the journal',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			resetting = false;
		}
	}

	const isJournalEmpty = $derived(
		journal.trades.length +
			journal.accounts.length +
			journal.notes.length +
			journal.tags.length +
			journal.playbooks.length ===
			0
	);

	const counts = $derived({
		trades: journal.trades.length,
		accounts: journal.accounts.length,
		notes: journal.notes.length,
		tags: journal.tags.length,
		playbooks: journal.playbooks.length
	});
</script>

<div class="stack">
	<Panel
		title="Export"
		subtitle="A complete JSON copy of your journal: accounts, trades with every fill, tags, playbooks, notes and settings. Provider keys are never included."
	>
		<p class="counts">
			{counts.trades} trades, {counts.accounts} accounts, {counts.notes} notes, {counts.tags} tags, {counts.playbooks}
			playbooks.
		</p>
		<Button busy={exporting} onclick={exportJournal}>
			{#snippet icon()}<DownloadSimpleIcon size={16} />{/snippet}
			Export journal
		</Button>
	</Panel>

	<Panel
		title="Import"
		subtitle="Restore an export or move between the web and desktop apps. Items are matched by id: existing ones are updated, new ones are added, nothing is deleted."
	>
		<input
			bind:this={fileInput}
			class="visually-hidden"
			type="file"
			accept="application/json,.json"
			tabindex="-1"
			aria-hidden="true"
			onchange={pickFile}
		/>
		<Button onclick={() => fileInput?.click()}>
			{#snippet icon()}<UploadSimpleIcon size={16} />{/snippet}
			Choose export file
		</Button>
	</Panel>

	<Panel
		title="Sample journal"
		subtitle="Six months of example stock and options trades in two separate accounts, so you can explore every report before logging your own."
	>
		<Button onclick={() => (sampleOpen = true)}>Load sample journal</Button>
	</Panel>

	<section class="danger-zone" aria-labelledby="danger-title">
		<h2 id="danger-title">Danger zone</h2>
		<div class="danger-row">
			<div>
				<h3>Delete journal</h3>
				<p class="danger-copy">
					Permanently deletes every account, trade, tag, playbook and note {env.user
						? 'in your Journalix account'
						: 'on this computer'}. Settings and market data providers are kept. There is no undo:
					export first if you might want it back.
				</p>
			</div>
			<Button
				variant="danger"
				disabled={isJournalEmpty}
				onclick={() => {
					resetText = '';
					resetOpen = true;
				}}>Delete journal</Button
			>
		</div>
		{#if isJournalEmpty}<p class="danger-copy empty-note">The journal is already empty.</p>{/if}
	</section>
</div>

<Dialog bind:open={importOpen} title="Import {pending?.name ?? 'journal'}?" size="sm">
	{#if pending}
		<p>
			This file has {pending.data.trades.length} trades, {pending.data.accounts.length} accounts, {pending
				.data.notes.length} notes, {pending.data.tags.length} tags and {pending.data.playbooks
				.length} playbooks, exported {pending.data.exportedAt.slice(0, 10)}.
		</p>
		<div class="spaced">
			<Checkbox
				id="import-settings"
				bind:checked={applySettings}
				description="Time zone, currency, commissions and theme from the file."
				>Also replace my settings</Checkbox
			>
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (importOpen = false)}>Cancel</Button>
		<Button variant="primary" busy={importing} onclick={confirmImport}>Import</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={sampleOpen} title="Load the sample journal?" size="sm">
	<p>
		Adds two example accounts, "Main margin" and "Roth IRA", with about six months of trades, tags,
		playbooks and notes. Your own data is not changed. Delete the two accounts later to remove the
		sample trades.
	</p>
	{#if !hasSimulator}
		<div class="spaced">
			<Checkbox
				id="sample-sim"
				bind:checked={addSimulator}
				description="Draws generated candles that pass through the sample fills, so charts work without an API key."
				>Add the simulated data provider</Checkbox
			>
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (sampleOpen = false)}>Cancel</Button>
		<Button variant="primary" busy={loadingSample} onclick={loadSample}>Load sample</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={resetOpen}
	title="Delete your whole journal?"
	description="This cannot be undone."
	size="sm"
>
	<p class="reset-list">
		This removes {counts.trades} trades, {counts.accounts} accounts, {counts.notes} notes, {counts.tags}
		tags and {counts.playbooks} playbooks.
	</p>
	<p class="reset-list">
		<button type="button" class="link" onclick={exportJournal} disabled={exporting}
			>Export a backup first</button
		>
	</p>
	<Field label={`Type "${RESET_PHRASE}" to confirm`} for="reset-confirm">
		<TextInput id="reset-confirm" bind:value={resetText} autocomplete="off" spellcheck={false} />
	</Field>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (resetOpen = false)}>Cancel</Button>
		<Button
			variant="danger"
			busy={resetting}
			disabled={resetText.trim().toLowerCase() !== RESET_PHRASE}
			onclick={reset}>Delete everything</Button
		>
	{/snippet}
</Dialog>

<style>
	.stack {
		display: grid;
		gap: var(--space-5);
	}

	.counts,
	.danger-copy {
		margin-bottom: var(--space-4);
		font-size: var(--text-sm);
		color: var(--color-ink-2);
		max-width: var(--prose-max);
	}

	.spaced {
		margin-top: var(--space-4);
	}

	/* Set apart from the routine panels above, and named for what it is. */
	.danger-zone {
		margin-top: var(--space-4);
		padding: var(--space-5);
		border: 1px solid color-mix(in oklab, var(--color-loss) 55%, var(--color-line));
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.danger-zone > h2 {
		margin-bottom: var(--space-3);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-loss-text);
	}

	.danger-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.danger-row > div {
		flex: 1 1 320px;
	}

	.danger-row h3 {
		font-size: var(--text-md);
		margin-bottom: var(--space-1);
	}

	.danger-row .danger-copy {
		margin-bottom: 0;
	}

	.empty-note {
		margin: var(--space-3) 0 0;
		color: var(--color-ink-3);
	}

	.reset-list {
		margin-bottom: var(--space-3);
		font-size: var(--text-sm);
		color: var(--color-ink-2);
	}

	.link {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.link:disabled {
		color: var(--color-ink-3);
		cursor: wait;
	}
</style>
