import { formatOccCompact } from '../../options/occ.ts';
import { errorFromResponse, ProviderError, requireSecret, type Bar, type MarketDataProvider, type Timeframe } from '../types.ts';

/** Alpaca Market Data API v2 (stocks) and v1beta1 (options). Docs: https://docs.alpaca.markets/reference/stockbars */
const FRAMES: Readonly<Record<Timeframe, string>> = {
	'1m': '1Min',
	'5m': '5Min',
	'15m': '15Min',
	'30m': '30Min',
	'1h': '1Hour',
	'4h': '4Hour',
	'1D': '1Day',
	'1W': '1Week'
};

interface AlpacaBar {
	readonly t: string;
	readonly o: number;
	readonly h: number;
	readonly l: number;
	readonly c: number;
	readonly v: number;
}

interface AlpacaResponse {
	readonly bars?: Readonly<Record<string, readonly AlpacaBar[]>> | null;
	readonly next_page_token?: string | null;
	readonly message?: string;
}

const MAX_PAGES = 20;

export const alpaca: MarketDataProvider = {
	id: 'alpaca',
	name: 'Alpaca',
	description: 'US stocks (IEX free / SIP paid) and options bars.',
	website: 'https://alpaca.markets',
	docs: 'https://docs.alpaca.markets/reference/stockbars',
	supportsOptions: true,
	timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
	fields: [
		{ name: 'apiKey', label: 'API key ID', kind: 'secret', required: true, placeholder: 'APCA-API-KEY-ID' },
		{ name: 'apiSecret', label: 'API secret key', kind: 'secret', required: true, placeholder: 'APCA-API-SECRET-KEY' },
		{
			name: 'feed',
			label: 'Stock feed',
			kind: 'select',
			required: false,
			defaultValue: 'iex',
			help: 'IEX is the only feed available without a market data subscription.',
			choices: [
				{ value: 'iex', label: 'IEX (free)' },
				{ value: 'sip', label: 'SIP — all US exchanges (subscription)' }
			]
		}
	],
	notice: 'Historical options data starts February 2024.',
	async fetchBars(req, ctx) {
		const key = requireSecret(ctx, 'apiKey', 'Alpaca');
		const secret = requireSecret(ctx, 'apiSecret', 'Alpaca');
		const isOption = req.instrument.type === 'option';
		const symbol = req.instrument.type === 'equity' ? req.instrument.symbol : formatOccCompact(req.instrument.contract);
		const path = isOption ? '/v1beta1/options/bars' : '/v2/stocks/bars';
		const bars: Bar[] = [];
		let pageToken: string | null = null;
		for (let page = 0; page < MAX_PAGES; page++) {
			const params = new URLSearchParams({
				symbols: symbol,
				timeframe: FRAMES[req.timeframe],
				start: new Date(req.from).toISOString(),
				end: new Date(req.to).toISOString(),
				limit: '10000',
				sort: 'asc'
			});
			if (!isOption) {
				params.set('adjustment', 'raw');
				params.set('feed', ctx.options['feed'] === 'sip' ? 'sip' : 'iex');
			}
			if (pageToken) params.set('page_token', pageToken);
			const res = await ctx.fetch(`https://data.alpaca.markets${path}?${params}`, {
				headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, Accept: 'application/json' },
				signal: ctx.signal ?? null
			});
			if (!res.ok) throw await errorFromResponse('Alpaca', res);
			let body: AlpacaResponse;
			try {
				body = (await res.json()) as AlpacaResponse;
			} catch {
				throw new ProviderError('parse', 'Alpaca returned an unreadable response');
			}
			for (const b of body.bars?.[symbol] ?? []) {
				bars.push({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
			}
			pageToken = body.next_page_token ?? null;
			if (!pageToken) break;
		}
		return bars;
	}
};
