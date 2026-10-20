import {
	errorFromResponse,
	ProviderError,
	requireSecret,
	type Bar,
	type MarketDataProvider,
	type Timeframe
} from '../types.ts';

/** Tiingo IEX intraday and end-of-day prices. Docs: https://www.tiingo.com/documentation/iex */
const INTRADAY: Partial<Readonly<Record<Timeframe, string>>> = {
	'1m': '1min',
	'5m': '5min',
	'15m': '15min',
	'30m': '30min',
	'1h': '1hour',
	'4h': '4hour'
};

interface TiingoRow {
	readonly date: string;
	readonly open: number;
	readonly high: number;
	readonly low: number;
	readonly close: number;
	readonly volume?: number;
}

const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const tiingo: MarketDataProvider = {
	id: 'tiingo',
	name: 'Tiingo',
	description: 'US stocks: IEX intraday bars and end-of-day history.',
	website: 'https://www.tiingo.com',
	docs: 'https://www.tiingo.com/documentation/iex',
	supportsOptions: false,
	timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
	fields: [
		{
			name: 'apiKey',
			label: 'API token',
			kind: 'secret',
			required: true,
			placeholder: 'Your Tiingo token'
		}
	],
	notice: 'Intraday bars come from IEX only, so volume is IEX volume.',
	async fetchBars(req, ctx) {
		if (req.instrument.type !== 'equity')
			throw new ProviderError('unsupported', 'Tiingo does not provide options bars');
		const token = requireSecret(ctx, 'apiKey', 'Tiingo');
		const symbol = encodeURIComponent(req.instrument.symbol.toLowerCase());
		const intraday = INTRADAY[req.timeframe];
		const params = new URLSearchParams({ startDate: day(req.from), endDate: day(req.to) });
		let url: string;
		if (intraday) {
			params.set('resampleFreq', intraday);
			params.set('columns', 'open,high,low,close,volume');
			params.set('afterHours', 'false');
			url = `https://api.tiingo.com/iex/${symbol}/prices?${params}`;
		} else {
			params.set('resampleFreq', req.timeframe === '1W' ? 'weekly' : 'daily');
			url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?${params}`;
		}
		const res = await ctx.fetch(url, {
			headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
			signal: ctx.signal ?? null
		});
		if (!res.ok) throw await errorFromResponse('Tiingo', res);
		let rows: readonly TiingoRow[];
		try {
			rows = (await res.json()) as readonly TiingoRow[];
		} catch {
			throw new ProviderError('parse', 'Tiingo returned an unreadable response');
		}
		if (!Array.isArray(rows))
			throw new ProviderError('upstream', 'Tiingo returned an unexpected payload');
		return rows.map((r): Bar => ({
			time: Math.floor(Date.parse(r.date) / 1000),
			open: r.open,
			high: r.high,
			low: r.low,
			close: r.close,
			volume: r.volume ?? 0
		}));
	}
};
