<script lang="ts">
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import {
		addDays,
		dailyPnl,
		dayKey,
		formatDayKey,
		formatMoney,
		formatPercent,
		newId,
		STRATEGIES,
		type Note
	} from '@journalix/core';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import IconButton from '../primitives/IconButton.svelte';
	import Panel from '../primitives/Panel.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import Field from '../primitives/Field.svelte';
	import Select from '../primitives/Select.svelte';
	import Textarea from '../primitives/Textarea.svelte';
	import CalendarMonth from '../charts/CalendarMonth.svelte';
	import YearHeatmap from '../charts/YearHeatmap.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Pnl from './parts/Pnl.svelte';
	import StatusBadge from './parts/StatusBadge.svelte';

	type NoteKind = Note['kind'];

	const { journal, env, toaster } = useApp();
	const tz = $derived(journal.settings.timeZone);
	const currency = $derived(journal.settings.baseCurrency);
	const days = $derived(dailyPnl(journal.filtered, tz));
	const today = $derived(dayKey(Date.now(), tz));

	let month = $derived((days[days.length - 1]?.date ?? today).slice(0, 7));
	let selected = $state<string | null>(null);

	function shiftMonth(delta: number): void {
		const [y, m] = month.split('-').map(Number);
		month = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1)).toISOString().slice(0, 7);
	}

	function goToday(): void {
		month = today.slice(0, 7);
		selected = today;
	}

	function selectDay(date: string): void {
		selected = date;
		month = date.slice(0, 7);
	}

	const monthLabel = $derived(
		new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);
	const monthDays = $derived(days.filter((d) => d.date.startsWith(month)));
	const monthPnl = $derived(monthDays.reduce((a, d) => a + d.pnl, 0));
	const monthTrades = $derived(monthDays.reduce((a, d) => a + d.trades, 0));
	const monthGreen = $derived(monthDays.filter((d) => d.pnl > 0).length);

	/** Calendar weeks of the visible month, each with its own total. */
	const weeks = $derived.by(() => {
		const start = journal.settings.weekStartsOn;
		const byDate = new Map(monthDays.map((d) => [d.date, d]));
		const first = `${month}-01`;
		const firstDow = new Date(`${first}T12:00:00Z`).getUTCDay();
		let cursor = addDays(first, -((firstDow - start + 7) % 7));
		const out: { from: string; to: string; pnl: number; trades: number; days: number }[] = [];
		while (cursor.slice(0, 7) <= month) {
			const from = cursor;
			let pnl = 0;
			let trades = 0;
			let active = 0;
			for (let i = 0; i < 7; i++) {
				const d = byDate.get(cursor);
				if (d) {
					pnl += d.pnl;
					trades += d.trades;
					active++;
				}
				cursor = addDays(cursor, 1);
			}
			out.push({ from, to: addDays(cursor, -1), pnl, trades, days: active });
		}
		return out;
	});

	const selectedDay = $derived(selected ? (days.find((d) => d.date === selected) ?? null) : null);
	const selectedTrades = $derived(
		selected
			? journal.filtered
					.filter((v) => {
						const closed = v.metrics.closedAt && dayKey(v.metrics.closedAt, tz) === selected;
						const opened = v.metrics.openedAt && dayKey(v.metrics.openedAt, tz) === selected;
						return closed || opened;
					})
					.sort(
						(a, b) => Date.parse(a.metrics.openedAt ?? '') - Date.parse(b.metrics.openedAt ?? '')
					)
			: []
	);
	const selectedNotes = $derived(selected ? journal.notes.filter((n) => n.date === selected) : []);

	const NOTE_KINDS: readonly { value: NoteKind; label: string }[] = [
		{ value: 'premarket', label: 'Pre-market plan' },
		{ value: 'recap', label: 'Recap' },
		{ value: 'lesson', label: 'Lesson' },
		{ value: 'general', label: 'Note' }
	];
	const kindLabel = (k: NoteKind): string => NOTE_KINDS.find((x) => x.value === k)?.label ?? k;

	let noteKind = $state<NoteKind>('recap');
	let noteBody = $state('');
	let savingNote = $state(false);

	async function addNote(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selected || !noteBody.trim()) return;
		savingNote = true;
		const now = new Date().toISOString();
		try {
			await journal.saveNote({
				id: newId(),
				date: selected,
				title: '',
				body: noteBody.trim(),
				kind: noteKind,
				createdAt: now,
				updatedAt: now
			});
			noteBody = '';
			toaster.success('Note saved');
		} catch (error) {
			toaster.error('Could not save the note', error instanceof Error ? error.message : undefined);
		} finally {
			savingNote = false;
		}
	}
</script>

<PageHeader
	title="Calendar"
	description="Closed P&L by trading day in {tz}. Select a day to review its trades and notes."
/>

{#if journal.trades.length === 0 && journal.notes.length === 0}
	<EmptyState
		title="Nothing to show on the calendar yet"
		message="Each trading day shows its closed P&L here, and you can attach a plan or recap to any day. Log a trade, or load the sample journal to see it filled in."
	>
		{#snippet icon()}<CalendarBlankIcon size={28} />{/snippet}
		{#snippet actions()}
			<Button href={env.href({ name: 'trade-new' })} variant="primary">New trade</Button>
			<Button href={env.href({ name: 'settings', section: 'data' })}>Load sample data</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="layout">
		<div class="area-month">
			<Panel title={monthLabel}>
				{#snippet actions()}
					<Button size="sm" variant="ghost" onclick={goToday}>Today</Button>
					<IconButton label="Previous month" size="sm" onclick={() => shiftMonth(-1)}
						><CaretLeftIcon size={16} /></IconButton
					>
					<IconButton label="Next month" size="sm" onclick={() => shiftMonth(1)}
						><CaretRightIcon size={16} /></IconButton
					>
				{/snippet}
				<CalendarMonth
					{month}
					{days}
					weekStartsOn={journal.settings.weekStartsOn}
					{currency}
					{selected}
					onselect={selectDay}
				/>
				<dl class="month-summary">
					<div>
						<dt>Month</dt>
						<dd><Pnl value={monthPnl} {currency} /></dd>
					</div>
					<div>
						<dt>Trades</dt>
						<dd class="num">{monthTrades}</dd>
					</div>
					<div>
						<dt>Green days</dt>
						<dd class="num">{monthGreen} of {monthDays.length}</dd>
					</div>
					<div>
						<dt>Green-day rate</dt>
						<dd class="num">
							{formatPercent(monthDays.length ? monthGreen / monthDays.length : null)}
						</dd>
					</div>
				</dl>
			</Panel>
		</div>

		<div class="area-weeks">
			<Panel title="Weeks">
				<table class="weeks">
					<caption class="visually-hidden">Weekly totals for {monthLabel}</caption>
					<thead>
						<tr
							><th scope="col">Week</th><th scope="col" class="num">Days traded</th><th
								scope="col"
								class="num">Trades</th
							><th scope="col" class="num">Net P&L</th></tr
						>
					</thead>
					<tbody>
						{#each weeks as week (week.from)}
							<tr class="row-hover">
								<th scope="row">{formatDayKey(week.from)} to {formatDayKey(week.to)}</th>
								<td class="num">{week.days}</td>
								<td class="num">{week.trades}</td>
								<td class="num"
									>{#if week.trades}<Pnl value={week.pnl} {currency} />{:else}<span class="muted"
											>—</span
										>{/if}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</Panel>
		</div>

		<div class="area-year">
			<Panel title="Last 52 weeks">
				<YearHeatmap
					{days}
					endDate={today}
					weekStartsOn={journal.settings.weekStartsOn}
					{currency}
					onselect={selectDay}
				/>
			</Panel>
		</div>

		<aside class="side" aria-label="Selected day">
			<Panel title={selected ? formatDayKey(selected, 'long') : 'No day selected'}>
				{#if !selected}
					<p class="muted">
						Select a day in the calendar to see the trades opened or closed that day and write a
						recap.
					</p>
					{#if days.length}
						{const latest = $derived(days[days.length - 1]?.date ?? '')}
						<Button size="sm" onclick={() => selectDay(latest)}
							>Open latest trading day, {formatDayKey(latest)}</Button
						>
					{/if}
				{:else}
					{#if selectedDay}
						<dl class="day-stats">
							<div>
								<dt>Net P&L</dt>
								<dd><Pnl value={selectedDay.pnl} {currency} /></dd>
							</div>
							<div>
								<dt>Closed</dt>
								<dd class="num">{selectedDay.trades}</dd>
							</div>
							<div>
								<dt>Won / lost</dt>
								<dd class="num">{selectedDay.wins} / {selectedDay.losses}</dd>
							</div>
							<div>
								<dt>Fees</dt>
								<dd class="num">{formatMoney(selectedDay.fees, { currency })}</dd>
							</div>
						</dl>
					{/if}

					<h3>Trades</h3>
					{#if selectedTrades.length}
						<ul class="trades">
							{#each selectedTrades as v (v.trade.id)}
								<li>
									<a class="row-hover" href={env.href({ name: 'trade', id: v.trade.id })}>
										<span class="sym">{v.trade.underlying}</span>
										<span class="strategy">{STRATEGIES[v.metrics.strategy].label}</span>
										<StatusBadge status={v.metrics.status} outcome={v.metrics.outcome} />
										<span class="pnl"
											>{#if v.metrics.status === 'closed'}<Pnl
													value={v.metrics.netPnl}
													{currency}
												/>{/if}</span
										>
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">No trades match the filters on this day.</p>
					{/if}

					<h3>Notes</h3>
					{#each selectedNotes as note (note.id)}
						<article class="note">
							<p class="kind">{kindLabel(note.kind)}{note.title ? `: ${note.title}` : ''}</p>
							<p class="body">{note.body}</p>
						</article>
					{:else}
						<p class="muted">No notes for this day.</p>
					{/each}

					<form class="note-form" onsubmit={addNote}>
						<Field label="Type" for="cal-note-kind">
							<Select id="cal-note-kind" bind:value={noteKind} options={NOTE_KINDS} />
						</Field>
						<Field label="Note" for="cal-note-body">
							<Textarea
								id="cal-note-body"
								bind:value={noteBody}
								rows={4}
								placeholder="What went well, what to repeat, what to stop."
							/>
						</Field>
						<Button type="submit" busy={savingNote} disabled={!noteBody.trim()}>Save note</Button>
					</form>
				{/if}
			</Panel>
		</aside>
	</div>
{/if}

<style>
	/*
	 * One column on small screens, in reading order: month, then the selected day (so choosing a day
	 * shows its trades right below the calendar), then weeks and the year view.
	 */
	.layout {
		display: grid;
		gap: var(--space-5);
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas:
			'month'
			'side'
			'weeks'
			'year';
	}

	.area-month {
		grid-area: month;
		min-width: 0;
	}

	.area-weeks {
		grid-area: weeks;
		min-width: 0;
	}

	.area-year {
		grid-area: year;
		min-width: 0;
	}

	.side {
		grid-area: side;
		min-width: 0;
	}

	@media (min-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 360px;
			grid-template-areas:
				'month side'
				'weeks side'
				'year side';
			grid-template-rows: auto auto 1fr;
			align-items: start;
		}

		.side {
			position: sticky;
			top: var(--space-5);
			align-self: start;
		}
	}

	.month-summary,
	.day-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-3) var(--space-5);
		margin: var(--space-4) 0 0;
	}

	dt {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	dd {
		margin: 0;
		font-size: var(--text-md);
	}

	.weeks {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	.weeks th,
	.weeks td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		text-align: left;
		font-weight: 400;
	}

	.weeks thead th {
		color: var(--color-ink-3);
	}

	.weeks .num {
		text-align: right;
	}

	h3 {
		margin: var(--space-5) 0 var(--space-2);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-ink-2);
	}

	.trades {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}

	.trades a {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
	}

	.trades a:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: -2px;
	}

	.sym {
		font-weight: 600;
	}

	.strategy {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.note {
		padding: var(--space-3);
		border-left: 2px solid var(--color-line-strong);
		margin-bottom: var(--space-3);
	}

	.note .kind {
		margin: 0 0 var(--space-1);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.note .body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.note-form {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
		justify-items: start;
	}

	.note-form :global(.field) {
		width: 100%;
	}

	.muted {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}
</style>
