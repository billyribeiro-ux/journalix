import { formatOccCompact } from '../../options/occ.ts';
import { errorFromResponse, ProviderError, requireSecret, type Bar, type MarketDataProvider, type Timeframe } from '../types.ts';

/** Massive (formerly Polygon.io) aggregates API. Docs: https://massive.com/docs/rest/stocks/aggregates/custom-bars */
const SPANS: Readonly<Record<Timeframe, readonly [number, string]>> = {
	'1m': [1, 'minute'],
	'5m': [5, 'minute'],
	'15m': [15, 'minute'],
	'30m': [30, 'minute'],
	'1h': [1, 'hour'],
	'4h': [4, 'hour'],
	'1D': [1, 'day'],
	'1W': [1, 'week']
};

interface MassiveAgg {
	readonly t: number;
	readonly o: number;
	readonly h: number;
	readonly l: number;
	readonly c: number;
	readonly v?: number;
}

interface MassiveResponse {
	readonly status?: string;
	readonly results?: readonly MassiveAgg[];
	readonly next_url?: string;
	readonly error?: string;
	readonly message?: string;
}

const MAX_PAGES = 20;

export const massive: MarketDataProvider = {
	id: 'massive',
	name: 'Massive (Polygon.io)',
	description: 'US stocks and options aggregates, minute to weekly bars.',
	website: 'https://massive.com',
	docs: 'https://massive.com/docs/rest/stocks/aggregates/custom-bars',
	supportsOptions: true,
	timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
	fields: [
		{ name: 'apiKey', label: 'API key', kind: 'secret', required: true, placeholder: 'Your Massive API key' },
		{
			name: 'baseUrl',
			label: 'API host',
			kind: 'select',
			required: false,
			defaultValue: 'https://api.massive.com',
			choices: [
				{ value: 'https://api.massive.com', label: 'api.massive.com' },
				{ value: 'https://api.polygon.io', label: 'api.polygon.io (legacy)' }
			]
		}
	],
	notice: 'Options bars need a plan that includes options data.',
	async fetchBars(req, ctx) {
		const apiKey = requireSecret(ctx, 'apiKey', 'Massive');
		const base = ctx.options['baseUrl'] === 'https://api.polygon.io' ? 'https://api.polygon.io' : 'https://api.massive.com';
		const ticker = req.instrument.type === 'equity' ? req.instrument.symbol : `O:${formatOccCompact(req.instrument.contract)}`;
		const [mult, span] = SPANS[req.timeframe];
		const params = new URLSearchParams({ adjusted: 'false', sort: 'asc', limit: '50000' });
		let url: string | null =
			`${base}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${mult}/${span}/${Math.floor(req.from)}/${Math.ceil(req.to)}?${params}`;
		const bars: Bar[] = [];
		for (let page = 0; url && page < MAX_PAGES; page++) {
			const withKey = new URL(url);
			withKey.searchParams.set('apiKey', apiKey);
			const res = await ctx.fetch(withKey.toString(), { signal: ctx.signal ?? null });
			if (!res.ok) throw await errorFromResponse('Massive', res);
			let body: MassiveResponse;
			try {
				body = (await res.json()) as MassiveResponse;
			} catch {
				throw new ProviderError('parse', 'Massive returned an unreadable response');
			}
			if (body.status === 'ERROR') throw new ProviderError('upstream', body.error ?? body.message ?? 'Massive error');
			for (const a of body.results ?? []) {
				bars.push({ time: Math.floor(a.t / 1000), open: a.o, high: a.h, low: a.l, close: a.c, volume: a.v ?? 0 });
			}
			url = body.next_url ?? null;
		}
		return bars;
	}
};
