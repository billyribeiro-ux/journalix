<script lang="ts">
	/**
	 * Trade review chart (TradingView Lightweight Charts): candles for the trade window with every
	 * entry, add, partial and exit marked at its fill price, the stop and target paths (every
	 * move), average-entry reference and shaded risk/reward zones.
	 */
	import type { Attachment } from 'svelte/attachments';
	import type { IChartApi, ISeriesApi, SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
	import {
		classifyExecutions,
		formatMoney,
		formatPrice,
		formatQuantity,
		type Execution,
		type ExecutionRole,
		type Leg,
		type TradeView
	} from '@journalix/core';
	import {
		bucketStart,
		TIMEFRAME_LABELS,
		TIMEFRAME_SECONDS,
		type Bar,
		type Timeframe
	} from '@journalix/core/market-data';
	import { readTheme, watchTheme, withAlpha, type ChartTheme } from './trade/theme.ts';
	import { ZonesPrimitive, type Zone } from './trade/zones.ts';

	interface Props {
		view: TradeView;
		/** Underlying (or contract) bars; `null` draws the fills on a price line only. */
		bars: readonly Bar[] | null;
		timeframe: Timeframe;
		timeZone: string;
		/** Bars came from the simulator — the chart shows a "Simulated prices" label. */
		simulated?: boolean;
		height?: number;
		/** `underlying` plots stock/underlying fills; `contract` plots option premiums. */
		mode?: 'underlying' | 'contract';
		/** Leg plotted in `contract` mode (defaults to the first option leg). */
		legId?: string;
	}

	let {
		view,
		bars,
		timeframe,
		timeZone,
		simulated = false,
		height = 420,
		mode = 'underlying',
		legId
	}: Props = $props();

	let legend = $state<{ time: string; o: number; h: number; l: number; c: number } | null>(null);
	/** `loading` until the first chart exists (the library is imported lazily); `error` if that fails. */
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	const id = $props.id();

	/** Fewest empty time slots before the first candle, so a marker label on the first bar is not clipped. */
	const LEAD_BARS = 6;

	type Phase = 'entry' | 'add' | 'partial' | 'exit' | 'expired' | 'assigned';

	interface Mark {
		readonly at: number;
		readonly price: number;
		readonly phase: Phase;
		readonly side: 'buy' | 'sell';
		readonly quantity: number;
		readonly label: string;
	}

	const PHASE_LABEL: Readonly<Record<Phase, string>> = {
		entry: 'Entry',
		add: 'Add',
		partial: 'Partial',
		exit: 'Exit',
		expired: 'Expired',
		assigned: 'Assigned'
	};

	function phaseOf(role: ExecutionRole | undefined, kind: Execution['kind']): Phase {
		if (kind === 'expiration') return 'expired';
		if (kind === 'assignment' || kind === 'exercise') return 'assigned';
		switch (role) {
			case 'add':
				return 'add';
			case 'reduce':
				return 'partial';
			case 'close':
			case 'flip':
				return 'exit';
			default:
				return 'entry';
		}
	}

	const isOptionLeg = (leg: Leg): boolean => leg.kind === 'call' || leg.kind === 'put';

	const contractLeg = $derived(
		mode === 'contract'
			? (view.trade.legs.find((l) => l.id === legId) ?? view.trade.legs.find(isOptionLeg) ?? null)
			: null
	);

	/** One mark per (time, phase): spread legs filled together collapse into a single marker. */
	const marks = $derived.by<Mark[]>(() => {
		const { trade } = view;
		const legs = contractLeg ? [contractLeg] : trade.legs;
		const singleLeg = trade.legs.length === 1;
		const grouped = new Map<string, Mark>();
		for (const leg of legs) {
			const roles = classifyExecutions(leg, trade.executions);
			for (const e of trade.executions) {
				if (e.legId !== leg.id) continue;
				const price = contractLeg ? e.price : isOptionLeg(leg) ? e.underlyingPrice : e.price;
				if (price === null || !(price > 0)) continue;
				const phase = phaseOf(roles.get(e.id), e.kind);
				const at = Date.parse(e.executedAt);
				const key = `${Math.floor(at / 60_000)}:${phase}`;
				const existing = grouped.get(key);
				if (existing) {
					grouped.set(key, {
						...existing,
						quantity: existing.quantity + (singleLeg || contractLeg ? e.quantity : 0)
					});
					continue;
				}
				grouped.set(key, {
					at,
					price,
					phase,
					side: e.side,
					quantity: singleLeg || contractLeg ? e.quantity : 0,
					label: PHASE_LABEL[phase]
				});
			}
		}
		return [...grouped.values()].sort((a, b) => a.at - b.at);
	});

	const isLinear = $derived(
		view.trade.legs.length === 1 && !isOptionLeg(view.trade.legs[0] as Leg)
	);
	const referenceEntry = $derived(
		contractLeg
			? (view.metrics.legs.find((s) => s.leg.id === contractLeg.id)?.averageOpenPrice ?? null)
			: isLinear
				? view.metrics.averageEntry
				: view.metrics.underlyingAtEntry
	);

	const summary = $derived.by(() => {
		const { trade, metrics } = view;
		const parts = [
			`${trade.underlying} ${metrics.direction} trade`,
			`${marks.length} ${marks.length === 1 ? 'fill' : 'fills'} marked`,
			metrics.initialStop !== null ? `stop ${formatPrice(metrics.initialStop)}` : null,
			metrics.initialTarget !== null ? `target ${formatPrice(metrics.initialTarget)}` : null,
			metrics.status === 'closed'
				? `net ${formatMoney(metrics.netPnl, { signed: true })}`
				: 'still open'
		];
		return parts.filter(Boolean).join(', ');
	});

	function zoned(seconds: number, opts: Intl.DateTimeFormatOptions): string {
		return new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(new Date(seconds * 1000));
	}

	const intraday = $derived(TIMEFRAME_SECONDS[timeframe] < 86_400);

	function formatTime(seconds: number): string {
		return intraday
			? zoned(seconds, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
			: zoned(seconds, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	/**
	 * Attachment that owns the Lightweight Charts instance for its element: it runs on mount, tears the
	 * chart down before every re-run and on unmount.
	 */
	const tradeChart: Attachment<HTMLDivElement> = (el) => {
		// Re-run whenever any input changes; the chart is rebuilt from scratch, which is cheap at this size.
		const input = { view, bars, timeframe, marks, referenceEntry, contractLeg, timeZone, intraday };
		let chart: IChartApi | null = null;
		let disposed = false;
		let stopTheme: (() => void) | null = null;

		void import('lightweight-charts')
			.then((lw) => {
				if (disposed) return;
				const theme = (): ChartTheme => readTheme(el);
				let t = theme();
				const step = TIMEFRAME_SECONDS[input.timeframe];
				const toTime = (ms: number): UTCTimestamp =>
					bucketStart(Math.floor(ms / 1000), input.timeframe) as UTCTimestamp;

				const chartOptions = (c: ChartTheme) => ({
					autoSize: true,
					layout: {
						background: { type: lw.ColorType.Solid, color: c.surface },
						textColor: c.text,
						fontFamily: c.font,
						fontSize: 11,
						attributionLogo: true
					},
					grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
					rightPriceScale: { borderColor: c.axis, scaleMargins: { top: 0.08, bottom: 0.18 } },
					timeScale: {
						borderColor: c.axis,
						timeVisible: input.intraday,
						secondsVisible: false,
						rightOffset: 4,
						tickMarkFormatter: (time: Time, tickType: number) => {
							const s = Number(time);
							if (tickType === lw.TickMarkType.Year) return zoned(s, { year: 'numeric' });
							if (tickType === lw.TickMarkType.Month) return zoned(s, { month: 'short' });
							if (tickType === lw.TickMarkType.DayOfMonth)
								return zoned(s, { month: 'short', day: 'numeric' });
							return zoned(s, { hour: 'numeric', minute: '2-digit' });
						}
					},
					localization: {
						timeFormatter: (time: Time) => formatTime(Number(time)),
						priceFormatter: (p: number) => formatPrice(p)
					},
					crosshair: {
						mode: lw.CrosshairMode.Normal,
						vertLine: {
							color: c.crosshair,
							width: 1 as const,
							style: lw.LineStyle.Solid,
							labelBackgroundColor: c.ink2
						},
						horzLine: {
							color: c.crosshair,
							width: 1 as const,
							style: lw.LineStyle.Solid,
							labelBackgroundColor: c.ink2
						}
					}
				});

				chart = lw.createChart(el, chartOptions(t));

				const sourceBars = input.bars ?? [];
				let main: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
				if (sourceBars.length > 0) {
					const candles = chart.addSeries(lw.CandlestickSeries, {
						upColor: t.gain,
						downColor: t.loss,
						borderUpColor: t.gain,
						borderDownColor: t.loss,
						wickUpColor: t.gain,
						wickDownColor: t.loss,
						priceLineVisible: false
					});
					// Marker text is centred on its bar, so an entry on the first bar would run off the left edge.
					// A few bar-less points before the first candle leave room for it.
					const first = sourceBars[0]?.time ?? 0;
					const step = Math.max(1, (sourceBars[1]?.time ?? first + 60) - first);
					// Sized so about 56px stays free whatever the bar spacing (narrow charts have narrower bars).
					const spacing = (el.clientWidth || 600) / (sourceBars.length + LEAD_BARS) || 12;
					const leadBars = Math.min(24, Math.max(LEAD_BARS, Math.ceil(56 / spacing)));
					const lead = Array.from({ length: leadBars }, (_, i) => ({
						time: (first - step * (leadBars - i)) as UTCTimestamp
					}));
					candles.setData([
						...lead,
						...sourceBars.map((b) => ({
							time: b.time as UTCTimestamp,
							open: b.open,
							high: b.high,
							low: b.low,
							close: b.close
						}))
					]);
					main = candles;
					const volume = chart.addSeries(lw.HistogramSeries, {
						priceScaleId: 'volume',
						priceFormat: { type: 'volume' },
						lastValueVisible: false,
						priceLineVisible: false
					});
					chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
					volume.setData(
						sourceBars.map((b) => ({
							time: b.time as UTCTimestamp,
							value: b.volume,
							color: withAlpha(b.close >= b.open ? t.gain : t.loss, 0.28)
						}))
					);
				} else {
					// No market data: connect the fills so the path of the trade is still visible.
					const line = chart.addSeries(lw.LineSeries, {
						color: t.ink3,
						lineWidth: 2,
						priceLineVisible: false,
						lastValueVisible: false,
						crosshairMarkerVisible: true
					});
					const points = new Map<number, number>();
					for (const m of input.marks) points.set(toTime(m.at), m.price);
					line.setData(
						[...points.entries()]
							.sort(([a], [b]) => a - b)
							.map(([time, value]) => ({ time: time as UTCTimestamp, value }))
					);
					main = line;
				}

				const lastTime = sourceBars.length
					? (sourceBars[sourceBars.length - 1]?.time ?? 0)
					: Math.max(...input.marks.map((m) => toTime(m.at)), 0);
				const firstMark = input.marks[0];
				const lastMark = input.marks[input.marks.length - 1];
				const openTime = firstMark ? toTime(firstMark.at) : null;
				const closeTime =
					input.view.metrics.status === 'closed' && lastMark
						? toTime(lastMark.at)
						: (lastTime as UTCTimestamp);

				// Stop and target paths: stepped lines that record every move. Levels live on the underlying.
				if (!input.contractLeg && openTime !== null) {
					const path = (kind: 'stop' | 'target', color: string, title: string) => {
						const levels = input.view.trade.levels
							.filter((l) => l.kind === kind)
							.sort((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt));
						if (levels.length === 0) return;
						const points = new Map<number, number>();
						for (const l of levels)
							points.set(Math.max(openTime, toTime(Date.parse(l.setAt))), l.price);
						const last = levels[levels.length - 1];
						if (last) points.set(Math.max(closeTime, openTime + step), last.price);
						const series = chart?.addSeries(lw.LineSeries, {
							color,
							lineWidth: 1,
							lineType: lw.LineType.WithSteps,
							priceLineVisible: false,
							lastValueVisible: true,
							crosshairMarkerVisible: false,
							title
						});
						series?.setData(
							[...points.entries()]
								.sort(([a], [b]) => a - b)
								.map(([time, value]) => ({ time: time as UTCTimestamp, value }))
						);
					};
					path('stop', t.loss, 'Stop');
					path('target', t.gain, 'Target');
				}

				if (input.referenceEntry !== null) {
					main.createPriceLine({
						price: input.referenceEntry,
						color: t.ink3,
						lineWidth: 1,
						lineStyle: lw.LineStyle.Solid,
						axisLabelVisible: true,
						title: input.contractLeg
							? 'Avg premium'
							: input.view.trade.legs.length > 1
								? 'Underlying at entry'
								: 'Avg entry'
					});
				}

				// Planned risk / reward zones from the entry to the initial stop and target.
				const zones = new ZonesPrimitive();
				main.attachPrimitive(zones);
				const zoneList: Zone[] = [];
				const entry = input.referenceEntry;
				const { initialStop, initialTarget } = input.view.metrics;
				if (!input.contractLeg && entry !== null && openTime !== null) {
					const to = (closeTime > openTime ? closeTime : openTime + step) as UTCTimestamp;
					if (initialStop !== null) {
						zoneList.push({
							from: openTime,
							to,
							top: Math.max(entry, initialStop),
							bottom: Math.min(entry, initialStop),
							fill: withAlpha(t.loss, 0.1),
							stroke: withAlpha(t.loss, 0.35)
						});
					}
					if (initialTarget !== null) {
						zoneList.push({
							from: openTime,
							to,
							top: Math.max(entry, initialTarget),
							bottom: Math.min(entry, initialTarget),
							fill: withAlpha(t.gain, 0.1),
							stroke: withAlpha(t.gain, 0.35)
						});
					}
				}
				zones.setZones(zoneList);

				const markerColor = (m: Mark, c: ChartTheme): string =>
					m.phase === 'entry' || m.phase === 'add'
						? c.entry
						: m.phase === 'expired'
							? c.neutral
							: c.ink;
				const markerList = (c: ChartTheme): SeriesMarker<Time>[] =>
					input.marks.map((m) => ({
						time: toTime(m.at),
						position: m.side === 'buy' ? ('atPriceBottom' as const) : ('atPriceTop' as const),
						price: m.price,
						shape: m.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
						color: markerColor(m, c),
						text: m.quantity > 0 ? `${m.label} (${formatQuantity(m.quantity)})` : m.label,
						size: 1.2
					}));
				const markers = lw.createSeriesMarkers(main, markerList(t), { zOrder: 'top' });

				chart.subscribeCrosshairMove((param) => {
					if (!param.time || sourceBars.length === 0) {
						legend = null;
						return;
					}
					const data = param.seriesData.get(main);
					if (data && 'open' in data) {
						legend = {
							time: formatTime(Number(param.time)),
							o: data.open,
							h: data.high,
							l: data.low,
							c: data.close
						};
					}
				});

				chart.timeScale().fitContent();

				stopTheme = watchTheme(() => {
					t = theme();
					chart?.applyOptions(chartOptions(t));
					markers.setMarkers(markerList(t));
				});
				status = 'ready';
			})
			.catch((error: unknown) => {
				if (disposed) return;
				// Surface it: a blank canvas with no explanation is the worst failure mode for a chart.
				console.error('Trade chart failed to draw', error);
				chart?.remove();
				chart = null;
				status = 'error';
			});

		return () => {
			disposed = true;
			stopTheme?.();
			chart?.remove();
			chart = null;
		};
	};

	const instrumentLabel = $derived(
		contractLeg && contractLeg.strike !== null
			? `${view.trade.underlying} ${formatPrice(contractLeg.strike)}${contractLeg.kind === 'call' ? 'C' : 'P'} ${contractLeg.expiration ?? ''}`
			: view.trade.underlying
	);
</script>

<figure class="trade-chart" aria-labelledby="{id}-caption">
	<figcaption id="{id}-caption" class="visually-hidden">Chart of {summary}.</figcaption>
	<div class="legend" aria-hidden="true">
		<span class="symbol">{instrumentLabel}</span>
		<span class="tf">{TIMEFRAME_LABELS[timeframe]}</span>
		{#if legend}
			<span class="ohlc num">
				<span>O {formatPrice(legend.o)}</span>
				<span>H {formatPrice(legend.h)}</span>
				<span>L {formatPrice(legend.l)}</span>
				<span>C {formatPrice(legend.c)}</span>
			</span>
		{/if}
		{#if simulated}<span class="sim">Simulated prices</span>{/if}
		{#if bars === null || bars.length === 0}<span class="sim">No market data — fills only</span
			>{/if}
	</div>
	<div class="stage" style:height="{height}px">
		<div class="canvas" {@attach tradeChart}></div>
		{#if status === 'loading'}
			<div class="skeleton cover" role="status">
				<span class="visually-hidden">Loading chart</span>
			</div>
		{:else if status === 'error'}
			<div class="cover failed" role="alert">
				<p>The chart could not be drawn.</p>
				<p class="hint">Reload the page to try again.</p>
			</div>
		{/if}
	</div>
	<ul class="visually-hidden">
		{#each marks as m (m.at + m.phase)}
			<li>
				{m.label}
				{m.side}
				{m.quantity > 0 ? formatQuantity(m.quantity) : ''} at {formatPrice(m.price)}, {formatTime(
					Math.floor(m.at / 1000)
				)}
			</li>
		{/each}
	</ul>
</figure>

<style>
	.trade-chart {
		position: relative;
		min-width: 0;
	}

	.stage {
		position: relative;
		width: 100%;
		min-height: 200px;
	}

	.canvas {
		width: 100%;
		height: 100%;
	}

	.cover {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.failed {
		display: grid;
		place-content: center;
		gap: var(--space-1);
		padding: var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		text-align: center;
		color: var(--color-ink-2);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.failed .hint {
		color: var(--color-ink-3);
		font-size: var(--text-xs);
		font-weight: 400;
	}

	.legend {
		position: absolute;
		top: var(--space-2);
		left: var(--space-3);
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
		pointer-events: none;
		font-size: var(--text-xs);
		color: var(--color-ink-3);
		max-width: calc(100% - 96px);
	}

	.symbol {
		font-weight: 600;
		font-size: var(--text-sm);
		color: var(--color-ink);
	}

	.ohlc {
		display: inline-flex;
		gap: var(--space-2);
	}

	.sim {
		padding: 1px 6px;
		border-radius: var(--radius-xs);
		background: var(--color-signal-soft);
		color: var(--color-ink);
	}
</style>
