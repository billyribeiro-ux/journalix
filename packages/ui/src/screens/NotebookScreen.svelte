<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { dailyPnl, dayKey, formatDayKey, newId, NoteSchema, type Note } from '@journalix/core';
	import * as v from 'valibot';
	import { untrack } from 'svelte';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import Field from '../primitives/Field.svelte';
	import TextInput from '../primitives/TextInput.svelte';
	import Textarea from '../primitives/Textarea.svelte';
	import Select from '../primitives/Select.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import ConfirmDialog from '../primitives/ConfirmDialog.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Pnl from './parts/Pnl.svelte';

	type Kind = Note['kind'];
	const KINDS: readonly { value: Kind; label: string }[] = [
		{ value: 'premarket', label: 'Pre-market plan' },
		{ value: 'recap', label: 'Recap' },
		{ value: 'lesson', label: 'Lesson' },
		{ value: 'general', label: 'Note' }
	];
	const kindLabel = (k: Kind): string => KINDS.find((x) => x.value === k)?.label ?? k;

	const { journal, env, toaster } = useApp();
	const tz = $derived(journal.settings.timeZone);
	const currency = $derived(journal.settings.baseCurrency);
	const pnlByDay = $derived(new Map(dailyPnl(journal.views, tz).map((d) => [d.date, d])));

	let query = $state('');
	let kindFilter = $state<Kind | 'all'>('all');
	const list = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return journal.notes
			.filter((n) => kindFilter === 'all' || n.kind === kindFilter)
			.filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
			.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
	});

	let selectedId = $state<string | null>(null);
	let draft = $state<Note | null>(null);
	let saving = $state(false);
	let error = $state<string | null>(null);

	function select(id: string | null): void {
		const note = id ? journal.notes.find((n) => n.id === id) : undefined;
		selectedId = note?.id ?? null;
		draft = note ? { ...note } : null;
		error = null;
	}

	select(
		untrack(() => journal.notes.toSorted((a, b) => b.date.localeCompare(a.date))[0]?.id ?? null)
	);

	const dirty = $derived.by(() => {
		if (!draft) return false;
		const stored = journal.notes.find((n) => n.id === draft?.id);
		if (!stored) return true;
		return (
			stored.title !== draft.title ||
			stored.body !== draft.body ||
			stored.kind !== draft.kind ||
			stored.date !== draft.date
		);
	});

	// Moving to another note (or a new one) while this one has unsaved edits asks first.
	let discardOpen = $state(false);
	let afterDiscard: (() => void) | null = null;
	let editorEl: HTMLElement | null = null;

	function guarded(action: () => void): void {
		if (!dirty) {
			action();
			return;
		}
		afterDiscard = action;
		discardOpen = true;
	}

	function openNote(id: string): void {
		guarded(() => {
			select(id);
			// On a phone the editor sits below the list: bring it into view.
			if (window.matchMedia('(max-width: 959px)').matches)
				editorEl?.scrollIntoView({ block: 'start' });
		});
	}

	function create(kind: Kind = 'premarket'): void {
		const now = new Date().toISOString();
		draft = {
			id: newId(),
			date: dayKey(Date.now(), tz),
			title: '',
			body: '',
			kind,
			createdAt: now,
			updatedAt: now
		};
		selectedId = null;
		error = null;
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!draft) return;
		const parsed = v.safeParse(NoteSchema, { ...draft, updatedAt: new Date().toISOString() });
		if (!parsed.success) {
			error = parsed.issues[0]?.message ?? 'Check the note';
			return;
		}
		if (!parsed.output.title && !parsed.output.body.trim()) {
			error = 'Write a title or some text before saving';
			return;
		}
		saving = true;
		try {
			const saved = await journal.saveNote(parsed.output);
			select(saved.id);
			toaster.success('Note saved');
		} catch (err) {
			toaster.error('Could not save the note', err instanceof Error ? err.message : undefined);
		} finally {
			saving = false;
		}
	}

	let confirmOpen = $state(false);

	async function remove(): Promise<void> {
		if (!draft) return;
		const id = draft.id;
		try {
			if (journal.notes.some((n) => n.id === id)) await journal.deleteNote(id);
			select(list[0]?.id ?? null);
			toaster.success('Note deleted');
		} catch (err) {
			toaster.error('Could not delete the note', err instanceof Error ? err.message : undefined);
		}
	}

	function onkeydown(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && draft) {
			event.preventDefault();
			(document.getElementById('note-form') as HTMLFormElement | null)?.requestSubmit();
		}
	}

	const excerpt = (body: string): string => body.replace(/\s+/g, ' ').trim().slice(0, 120);
	const draftDay = $derived(draft ? pnlByDay.get(draft.date) : undefined);
</script>

<svelte:window {onkeydown} />

<PageHeader
	title="Notebook"
	description="Pre-market plans, end-of-day recaps and the lessons you want to keep."
>
	{#snippet actions()}
		<Button variant="primary" onclick={() => guarded(() => create())}>
			{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
			New note
		</Button>
	{/snippet}
</PageHeader>

{#if journal.notes.length === 0 && !draft}
	<EmptyState
		title="Your notebook is empty"
		message="Write a plan before the open and a recap after the close. Notes are attached to a trading day and show up on the calendar."
	>
		{#snippet actions()}
			<Button variant="primary" onclick={() => create('premarket')}>Write a pre-market plan</Button>
			<Button onclick={() => create('recap')}>Write a recap</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="layout">
		<section class="list" aria-label="Notes">
			<div class="search">
				<MagnifyingGlassIcon size={16} aria-hidden="true" />
				<label class="visually-hidden" for="note-search">Search notes</label>
				<input id="note-search" type="search" placeholder="Search notes" bind:value={query} />
			</div>
			<Segmented
				label="Type"
				size="sm"
				bind:value={kindFilter}
				options={[
					{ value: 'all', label: 'All' },
					...KINDS.map((k) => ({
						value: k.value,
						label: k.value === 'premarket' ? 'Plans' : `${k.label}s`
					}))
				]}
			/>
			<ul role="list">
				{#each list as note (note.id)}
					<li>
						<button
							type="button"
							class={['item', note.id === selectedId && 'active']}
							aria-current={note.id === selectedId ? 'true' : undefined}
							onclick={() => openNote(note.id)}
						>
							<span class="meta"
								>{formatDayKey(note.date)}, {kindLabel(note.kind).toLowerCase()}</span
							>
							<span class="title"
								>{note.title || excerpt(note.body).slice(0, 48) || 'Untitled'}</span
							>
							{#if note.title && note.body}<span class="excerpt">{excerpt(note.body)}</span>{/if}
						</button>
					</li>
				{:else}
					<li class="none">
						<p>No notes match{query.trim() ? ` “${query.trim()}”` : ' this type'}.</p>
						<button
							type="button"
							class="link"
							onclick={() => {
								query = '';
								kindFilter = 'all';
							}}>Show all notes</button
						>
					</li>
				{/each}
			</ul>
		</section>

		<section
			class="editor"
			aria-label="Note editor"
			{@attach (el) => {
				editorEl = el;
				return () => (editorEl = null);
			}}
		>
			{#if draft}
				<form id="note-form" onsubmit={save} novalidate>
					<div class="row">
						<Field label="Trading day" for="note-date">
							<TextInput id="note-date" type="date" bind:value={draft.date} required />
						</Field>
						<Field label="Type" for="note-kind">
							<Select id="note-kind" bind:value={draft.kind} options={KINDS} />
						</Field>
						{#if draftDay}
							<div class="day">
								<span>That day</span>
								<Pnl value={draftDay.pnl} {currency} />
								<a href={env.href({ name: 'calendar' })}
									>{draftDay.trades} {draftDay.trades === 1 ? 'trade' : 'trades'}</a
								>
							</div>
						{/if}
					</div>
					<Field label="Title" for="note-title" optional>
						<TextInput id="note-title" bind:value={draft.title} maxlength={200} />
					</Field>
					<Field
						label="Note"
						for="note-body"
						help="Plain text. Saved with Ctrl or Cmd + S."
						{error}
					>
						<Textarea id="note-body" bind:value={draft.body} rows={18} invalid={!!error} />
					</Field>
					<div class="actions">
						<Button type="submit" variant="primary" busy={saving} disabled={!dirty}
							>Save note</Button
						>
						<span class={['state', { dirty }]} aria-live="polite">
							{#if dirty}<span class="dot" aria-hidden="true"></span>Unsaved changes{/if}
						</span>
						<Button variant="ghost" onclick={() => (confirmOpen = true)}>
							{#snippet icon()}<TrashIcon size={16} />{/snippet}
							Delete
						</Button>
					</div>
				</form>
			{:else}
				<p class="muted">Select a note or write a new one.</p>
			{/if}
		</section>
	</div>
{/if}

<ConfirmDialog
	bind:open={discardOpen}
	title="Discard unsaved changes?"
	message="This note has edits that were not saved. Leaving it now loses them."
	confirmLabel="Discard changes"
	tone="danger"
	onconfirm={() => {
		const next = afterDiscard;
		afterDiscard = null;
		next?.();
	}}
/>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete this note?"
	message="This cannot be undone."
	confirmLabel="Delete note"
	tone="danger"
	onconfirm={remove}
/>

<style>
	.layout {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 960px) {
		.layout {
			grid-template-columns: 320px minmax(0, 1fr);
			align-items: start;
		}
	}

	.list {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		height: 36px;
		border: 1px solid var(--color-control-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink-3);
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		.search {
			height: var(--control-touch);
		}

		.search input {
			font-size: max(16px, var(--text-base));
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.search:hover:not(:focus-within) {
			border-color: var(--color-ink-3);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.search:focus-within {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: 0;
		border-color: transparent;
		transition-delay: 0s;
	}

	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		outline: none;
	}

	ul {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
		max-height: 70vh;
		overflow-y: auto;
	}

	.item {
		display: grid;
		gap: 2px;
		width: 100%;
		padding: var(--space-3);
		border: 0;
		border-left: 2px solid transparent;
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		background: transparent;
		color: inherit;
		text-align: left;
	}

	.item {
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.item:hover {
			background: var(--color-hover);
			transition-delay: var(--hover-delay-tint);
		}
	}

	.item:focus-visible,
	.item:active {
		transition-delay: 0s;
	}

	.item.active {
		background: var(--color-surface-2);
		border-left-color: var(--color-signal);
	}

	.item:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: -2px;
	}

	.meta {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	.title {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.excerpt {
		font-size: var(--text-sm);
		color: var(--color-ink-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.none {
		display: grid;
		justify-items: start;
		gap: var(--space-1);
		padding: var(--space-3);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.none p {
		margin: 0;
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

	.editor {
		padding: var(--space-5);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
	}

	form {
		display: grid;
		gap: var(--space-4);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		align-items: flex-end;
	}

	.day {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--color-ink-2);
	}

	.state .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-signal);
		box-shadow: 0 0 0 1px var(--color-signal-fg);
	}
</style>
