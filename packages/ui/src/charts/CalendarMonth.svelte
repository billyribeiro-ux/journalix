<script lang="ts">
	import type { DailyPnl } from '@journalix/core';
	import { formatMoney } from '@journalix/core';
	import ChartTooltip from './ChartTooltip.svelte';
	import type { TooltipRow } from './chart-utils.ts';
	import {
		FLAT_FILL,
		compactSignedMoney,
		dayMs,
		divergingFill,
		pnlAcross,
		shiftDay,
		weekdayMonthDay,
		weekdayOf
	} from './chart-utils.ts';

	interface Props {
		month: string;
		days: readonly DailyPnl[];
		weekStartsOn: 0 | 1;
		currency: string;
		selected?: string | null;
		onselect?: (date: string) => void;
	}

	let { month, days, weekStartsOn, currency, selected = null, onselect }: Props = $props();

	const uid = $props.id();

	let width = $state(0);
	let hovered = $state<string | null>(null);
	let focusedDay = $state<string | null>(null);
	let grid = $state<HTMLDivElement>();

	const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const WEEKDAY_LONG = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday'
	];

	const valid = $derived(/^\d{4}-\d{2}$/.test(month));
	const first = $derived(`${valid ? month : '1970-01'}-01`);

	const daysInMonth = $derived.by(() => {
		const [y, m] = first.split('-').map(Number) as [number, number];
		return new Date(Date.UTC(y, m, 0)).getUTCDate();
	});

	const byDate = $derived(
		new Map(days.filter((d) => d.date.startsWith(`${month}-`)).map((d) => [d.date, d]))
	);

	const maxAbs = $derived([...byDate.values()].reduce((m, d) => Math.max(m, Math.abs(d.pnl)), 0));

	const monthTitle = $derived(
		new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
			new Date(dayMs(first))
		)
	);

	const columns = $derived(Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7));

	interface Cell {
		readonly date: string;
		readonly inMonth: boolean;
		readonly day: number;
		readonly weekday: number;
		readonly data: DailyPnl | null;
	}

	interface Week {
		readonly key: string;
		readonly cells: readonly Cell[];
		readonly pnl: number;
		readonly trades: number;
	}

	const weeks = $derived.by((): Week[] => {
		const lead = (weekdayOf(first) - weekStartsOn + 7) % 7;
		const start = shiftDay(first, -lead);
		const total = Math.ceil((lead + daysInMonth) / 7) * 7;
		const out: Week[] = [];
		for (let w = 0; w < total / 7; w++) {
			const cells: Cell[] = [];
			let pnl = 0;
			let trades = 0;
			for (let i = 0; i < 7; i++) {
				const date = shiftDay(start, w * 7 + i);
				const inMonth = date.startsWith(`${month}-`);
				const data = inMonth ? (byDate.get(date) ?? null) : null;
				if (data) {
					pnl += data.pnl;
					trades += data.trades;
				}
				cells.push({ date, inMonth, day: Number(date.slice(8)), weekday: weekdayOf(date), data });
			}
			out.push({ key: cells[0]?.date ?? String(w), cells, pnl, trades });
		}
		return out;
	});

	const actionable = $derived(
		weeks.flatMap((w) => w.cells.filter((c) => c.data !== null).map((c) => c.date))
	);

	/** Single tab stop: the selected day, else the last focused, else the latest trading day. */
	const tabStop = $derived.by(() => {
		if (selected && actionable.includes(selected)) return selected;
		if (focusedDay && actionable.includes(focusedDay)) return focusedDay;
		return actionable[actionable.length - 1] ?? null;
	});

	const compact = $derived(width > 0 && width < 380);
	const showWeekdayLong = $derived(width >= 640);

	function fillFor(cell: Cell): string {
		if (!cell.data) return 'var(--color-surface)';
		if (cell.data.pnl === 0) return FLAT_FILL;
		return divergingFill(cell.data.pnl, maxAbs);
	}

	function ariaFor(cell: Cell): string {
		const base = weekdayMonthDay(cell.date);
		if (!cell.data) return `${base}: no trades`;
		return `${base}: ${pnlAcross(cell.data.pnl, cell.data.trades, currency)}`;
	}

	function moveFocus(from: string, delta: number): void {
		let target = shiftDay(from, delta);
		// Skip non-trading days in the direction of travel; stay inside the month.
		for (let guard = 0; guard < 62; guard++) {
			if (!target.startsWith(`${month}-`)) return;
			if (byDate.has(target)) break;
			target = shiftDay(target, Math.sign(delta) * (Math.abs(delta) === 7 ? 7 : 1));
		}
		if (!byDate.has(target)) return;
		grid?.querySelector<HTMLButtonElement>(`button[data-date="${target}"]`)?.focus();
	}

	function onkeydown(event: KeyboardEvent, date: string): void {
		const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
		const delta = map[event.key];
		if (delta !== undefined) {
			event.preventDefault();
			moveFocus(date, delta);
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const target = event.key === 'Home' ? actionable[0] : actionable[actionable.length - 1];
			if (target) grid?.querySelector<HTMLButtonElement>(`button[data-date="${target}"]`)?.focus();
		} else if (event.key === 'Escape') {
			hovered = null;
		}
	}

	const tipDay = $derived(hovered ?? focusedDay);
	const tipData = $derived(tipDay ? (byDate.get(tipDay) ?? null) : null);

	let tipAnchor = $state<{ x: number; y: number } | null>(null);
	let wrapHeight = $state(0);

	function anchorTo(el: HTMLElement): void {
		const wrap = grid?.parentElement;
		if (!wrap) return;
		const a = el.getBoundingClientRect();
		const b = wrap.getBoundingClientRect();
		tipAnchor = { x: a.right - b.left - 4, y: a.top - b.top + a.height / 2 };
	}

	const tooltipRows = $derived.by((): TooltipRow[] => {
		const d = tipData;
		if (!d) return [];
		return [
			{ label: 'Net P&L', value: formatMoney(d.pnl, { currency, signed: true }) },
			{ label: 'Trades', value: String(d.trades) },
			{ label: 'Wins', value: String(d.wins) },
			{ label: 'Losses', value: String(d.losses) }
		];
	});

	const monthTotal = $derived([...byDate.values()].reduce((s, d) => s + d.pnl, 0));
	const monthTrades = $derived([...byDate.values()].reduce((s, d) => s + d.trades, 0));
	const summary = $derived(
		byDate.size === 0
			? `${monthTitle}: no trades.`
			: `${monthTitle}: ${pnlAcross(monthTotal, monthTrades, currency)} on ${byDate.size} trading ${byDate.size === 1 ? 'day' : 'days'}.`
	);
</script>

<figure class="calendar" aria-labelledby="{uid}-title">
	<figcaption id="{uid}-title" class="visually-hidden">{summary}</figcaption>
	<div class="wrap" bind:clientWidth={width} bind:clientHeight={wrapHeight}>
		<div
			class={['grid', compact && 'compact']}
			role="grid"
			aria-label="{monthTitle} trading calendar"
			aria-describedby="{uid}-title"
			bind:this={grid}
		>
			<div class="row head" role="row">
				{#each columns as wd (wd)}
					<div
						class={['colhead', (wd === 0 || wd === 6) && 'weekend']}
						role="columnheader"
						aria-label={WEEKDAY_LONG[wd]}
					>
						{showWeekdayLong
							? WEEKDAY_SHORT[wd]
							: (WEEKDAY_SHORT[wd] ?? '').slice(0, compact ? 1 : 3)}
					</div>
				{/each}
				<div class="colhead total" role="columnheader" aria-label="Week total">
					{compact ? 'Wk' : 'Week'}
				</div>
			</div>
			{#each weeks as week (week.key)}
				<div class="row" role="row">
					{#each week.cells as cell (cell.date)}
						{const weekend = $derived(cell.weekday === 0 || cell.weekday === 6)}
						<div
							role="gridcell"
							class="cellwrap"
							aria-selected={cell.data ? selected === cell.date : undefined}
						>
							{#if !cell.inMonth}
								<div class="cell outside" aria-hidden="true"></div>
							{:else if cell.data}
								{const d = $derived(cell.data)}
								<button
									type="button"
									class={[
										'cell active',
										weekend && 'weekend',
										selected === cell.date && 'selected'
									]}
									style:background={fillFor(cell)}
									data-date={cell.date}
									tabindex={tabStop === cell.date ? 0 : -1}
									aria-label={ariaFor(cell)}
									aria-pressed={selected === cell.date}
									onclick={() => onselect?.(cell.date)}
									onkeydown={(e) => onkeydown(e, cell.date)}
									onpointerenter={(e) => {
										hovered = cell.date;
										anchorTo(e.currentTarget);
									}}
									onpointerleave={() => (hovered = null)}
									onfocus={(e) => {
										focusedDay = cell.date;
										anchorTo(e.currentTarget);
									}}
									onblur={() => (focusedDay = null)}
								>
									<span class="num">{cell.day}</span>
									{#if compact}
										<span class={['dot', { gain: d.pnl > 0, loss: d.pnl < 0 }]} aria-hidden="true"
											>{d.pnl > 0 ? '+' : d.pnl < 0 ? '−' : ''}</span
										>
									{:else}
										<span class="pnl">{compactSignedMoney(d.pnl, currency)}</span>
										<span class="trades">{d.trades} {d.trades === 1 ? 'trade' : 'trades'}</span>
									{/if}
								</button>
							{:else}
								<div class={['cell idle', weekend && 'weekend']} aria-label={ariaFor(cell)}>
									<span class="num">{cell.day}</span>
								</div>
							{/if}
						</div>
					{/each}
					<div role="gridcell" class="cellwrap">
						<div
							class="cell total"
							aria-label={week.trades
								? `Week of ${weekdayMonthDay(week.cells[0]?.date ?? first)}: ${pnlAcross(week.pnl, week.trades, currency)}`
								: `Week of ${weekdayMonthDay(week.cells[0]?.date ?? first)}: no trades`}
						>
							{#if week.trades > 0}
								{#if compact}
									<span class="pnl small">{compactSignedMoney(week.pnl, currency)}</span>
								{:else}
									<span class="pnl">{compactSignedMoney(week.pnl, currency)}</span>
									<span class="trades">{week.trades} {week.trades === 1 ? 'trade' : 'trades'}</span>
								{/if}
							{:else}
								<span class="trades">—</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
		{#if tipData && tipDay && tipAnchor}
			<ChartTooltip
				x={tipAnchor.x}
				y={tipAnchor.y}
				boundsWidth={width}
				boundsHeight={wrapHeight}
				title={weekdayMonthDay(tipDay)}
				rows={tooltipRows}
			/>
		{/if}
	</div>
</figure>

<style>
	.calendar {
		margin: 0;
		min-width: 0;
	}

	.wrap {
		position: relative;
		width: 100%;
		min-width: 0;
	}

	.grid {
		display: grid;
		gap: 4px;
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, 1.15fr);
		gap: 4px;
	}

	.compact .row {
		gap: 2px;
		grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, 1.75fr);
	}

	.compact {
		gap: 2px;
	}

	.colhead {
		padding: 0 var(--space-1) var(--space-1);
		font-size: var(--text-2xs);
		color: var(--color-ink-3);
		text-align: left;
	}

	.colhead.total {
		text-align: right;
	}

	.compact .colhead {
		text-align: center;
		padding-inline: 0;
	}

	.compact .colhead.total {
		text-align: right;
	}

	.cellwrap {
		display: flex;
		min-width: 0;
	}

	.cell {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: space-between;
		gap: 2px;
		width: 100%;
		min-width: 0;
		min-height: 68px;
		margin: 0;
		padding: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		text-align: left;
		font: inherit;
		overflow: hidden;
	}

	.compact .cell {
		min-height: 40px;
		padding: 3px;
		align-items: center;
		justify-content: center;
		gap: 0;
	}

	@media (pointer: coarse) {
		.compact .cell {
			min-height: var(--control-touch);
		}
	}

	.cell.outside {
		border-color: transparent;
		background: transparent;
	}

	.cell.idle .num {
		color: var(--color-ink-3);
	}

	.cell.weekend {
		background: var(--color-surface-2);
	}

	button.cell {
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	button.cell:hover {
		border-color: var(--color-ink-3);
	}

	button.cell.selected {
		border-color: var(--color-signal);
		box-shadow: inset 0 0 0 1px var(--color-signal);
	}

	button.cell:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	.num {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--color-ink-2);
		line-height: 1;
	}

	.pnl {
		max-width: 100%;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-ink);
		line-height: var(--leading-tight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pnl.small {
		font-size: var(--text-2xs);
	}

	.trades {
		max-width: 100%;
		font-size: var(--text-2xs);
		color: var(--color-ink-2);
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dot {
		display: grid;
		place-items: center;
		width: 14px;
		height: 14px;
		margin-top: 3px;
		border-radius: 50%;
		background: var(--color-neutral);
		box-shadow: 0 0 0 2px var(--color-surface);
		color: var(--color-surface);
		font-size: var(--text-2xs);
		font-weight: 700;
		line-height: 1;
	}

	.dot.gain {
		background: var(--color-gain);
	}

	.dot.loss {
		background: var(--color-loss);
	}

	.cell.total {
		align-items: flex-end;
		background: var(--color-surface-2);
		border-color: transparent;
	}

	.compact .cell.total {
		align-items: flex-end;
		padding-inline: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		button.cell {
			transition: none;
		}
	}
</style>
