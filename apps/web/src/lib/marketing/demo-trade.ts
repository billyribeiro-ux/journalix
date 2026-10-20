import { buildTradeViews, type TradeView } from '@journalix/core';
import { createSampleJournal } from '@journalix/core/sample';
import {
	PROVIDERS,
	chooseTimeframe,
	windowFor,
	type Bar,
	type Timeframe
} from '@journalix/core/market-data';

/** Everything the home-page hero needs to draw one sample trade on its chart. */
export interface DemoTrade {
	readonly view: TradeView;
	readonly bars: readonly Bar[];
	readonly timeframe: Timeframe;
	readonly timeZone: string;
}

const TIME_ZONE = 'America/New_York';
/** Fixed inputs keep the sample (and so the prerendered page) identical on every build. */
const END_DAY = '2026-10-16';
const SEED = 20_261_020;

const sessionClock = new Intl.DateTimeFormat('en-US', {
	timeZone: TIME_ZONE,
	hourCycle: 'h23',
	hour: '2-digit',
	minute: '2-digit'
});

/** 09:30–16:00 New York time. */
function inRegularSession(instant: number): boolean {
	const [h = 0, m = 0] = sessionClock.format(new Date(instant)).split(':').map(Number);
	const minutes = h * 60 + m;
	return minutes >= 9 * 60 + 30 && minutes <= 16 * 60;
}

/**
 * Picks a closed long-call trade from the deterministic sample journal that scaled in and
 * scaled out, then generates simulated underlying candles that pass through its fills.
 *
 * Sample record ids are random UUIDs, so this runs once on the server and the result is
 * serialised to the page rather than recomputed in the browser.
 */
export async function loadDemoTrade(): Promise<DemoTrade> {
	const journal = createSampleJournal({ endDay: END_DAY, seed: SEED });
	const views = buildTradeViews(journal.trades, {
		timeZone: TIME_ZONE,
		breakevenThreshold: journal.settings.breakevenThreshold
	});

	const candidates = views.filter(
		(v) =>
			v.metrics.status === 'closed' &&
			v.metrics.adds > 0 &&
			v.metrics.partialExits > 0 &&
			(v.metrics.strategy === 'long_call' || v.metrics.strategy === 'shares_long') &&
			// Intraday candles cover the regular session only; every fill must land on one.
			v.trade.executions.every((e) => inRegularSession(Date.parse(e.executedAt)))
	);
	// Prefer an option trade, then the largest position, so the ledger has the most to show.
	const view = candidates.toSorted(
		(a, b) =>
			Number(b.metrics.strategy === 'long_call') - Number(a.metrics.strategy === 'long_call') ||
			b.metrics.quantity - a.metrics.quantity ||
			Date.parse(b.metrics.openedAt ?? '') - Date.parse(a.metrics.openedAt ?? '')
	)[0];
	if (!view || !view.metrics.openedAt || !view.metrics.closedAt) {
		throw new Error('The sample journal has no closed trade with an add and a partial exit');
	}

	const openedAt = Date.parse(view.metrics.openedAt);
	const closedAt = Date.parse(view.metrics.closedAt);
	const timeframe = chooseTimeframe(closedAt - openedAt);
	const { from, to } = windowFor(openedAt, closedAt, timeframe, Date.parse(`${END_DAY}T21:00:00Z`));

	const bars = await PROVIDERS.simulated.fetchBars(
		{
			instrument: { type: 'equity', symbol: view.trade.underlying },
			timeframe,
			from,
			to,
			anchors: view.trade.executions.map((e) => ({
				time: Date.parse(e.executedAt),
				price: e.underlyingPrice ?? e.price
			}))
		},
		{ secret: {}, options: {}, fetch }
	);

	return { view, bars, timeframe, timeZone: TIME_ZONE };
}
