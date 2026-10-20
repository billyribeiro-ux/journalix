import { formatOcc } from '../../options/occ.ts';
import { resample } from '../timeframes.ts';
import {
	errorFromResponse,
	ProviderError,
	requireSecret,
	type Bar,
	type MarketDataProvider,
	type Timeframe
} from '../types.ts';

/**
 * Databento Historical HTTP API, `timeseries.get_range` with JSON encoding.
 * POST https://hist.databento.com/v0/timeseries.get_range, HTTP Basic auth with the API key as
 * the username. Prices are fixed-point integers (1 unit = 1e-9); timestamps are UNIX nanoseconds.
 * Docs: https://databento.com/docs/api-reference-historical/timeseries/timeseries-get-range
 */
const NATIVE: Readonly<Record<Timeframe, { schema: string; resampleTo: Timeframe | null }>> = {
	'1m': { schema: 'ohlcv-1m', resampleTo: null },
	'5m': { schema: 'ohlcv-1m', resampleTo: '5m' },
	'15m': { schema: 'ohlcv-1m', resampleTo: '15m' },
	'30m': { schema: 'ohlcv-1m', resampleTo: '30m' },
	'1h': { schema: 'ohlcv-1h', resampleTo: null },
	'4h': { schema: 'ohlcv-1h', resampleTo: '4h' },
	'1D': { schema: 'ohlcv-1d', resampleTo: null },
	'1W': { schema: 'ohlcv-1d', resampleTo: '1W' }
};

type Num = number | string;

interface DbnOhlcv {
	readonly hd?: { readonly ts_event?: Num };
	readonly ts_event?: Num;
	readonly open: Num;
	readonly high: Num;
	readonly low: Num;
	readonly close: Num;
	readonly volume: Num;
}

const FIXED = 1e-9;

/**
 * JSON encoding without pretty prices (the default) carries fixed-point integers in units of
 * 1e-9, as strings (exact) or numbers. A decimal string is only accepted defensively.
 */
function price(value: Num): number {
	if (typeof value === 'number') return value * FIXED;
	return value.includes('.') ? Number(value) : Number(BigInt(value)) * FIXED;
}

function nanosToSeconds(value: Num | undefined): number {
	if (value === undefined) return Number.NaN;
	if (typeof value === 'number') return Math.floor(value / 1e9);
	if (/^\d+$/.test(value)) return Number(BigInt(value) / 1_000_000_000n);
	return Math.floor(Date.parse(value) / 1000);
}

function base64(text: string): string {
	return btoa(text);
}

export const databento: MarketDataProvider = {
	id: 'databento',
	name: 'Databento',
	description: 'Institutional-grade US equities and OPRA options history.',
	website: 'https://databento.com',
	docs: 'https://databento.com/docs/api-reference-historical/timeseries/timeseries-get-range',
	supportsOptions: true,
	timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
	fields: [
		{ name: 'apiKey', label: 'API key', kind: 'secret', required: true, placeholder: 'db-…' },
		{
			name: 'dataset',
			label: 'Equities dataset',
			kind: 'select',
			required: false,
			defaultValue: 'EQUS.MINI',
			choices: [
				{ value: 'EQUS.MINI', label: 'EQUS.MINI — US Equities Mini' },
				{ value: 'DBEQ.BASIC', label: 'DBEQ.BASIC — US Equities Basic' },
				{ value: 'XNAS.ITCH', label: 'XNAS.ITCH — Nasdaq TotalView' }
			]
		},
		{
			name: 'optionsDataset',
			label: 'Options dataset',
			kind: 'select',
			required: false,
			defaultValue: 'OPRA.PILLAR',
			choices: [{ value: 'OPRA.PILLAR', label: 'OPRA.PILLAR — US options' }]
		}
	],
	notice:
		'Databento bills per request. Bars are cached after the first fetch, so each window is paid for once.',
	async fetchBars(req, ctx) {
		const key = requireSecret(ctx, 'apiKey', 'Databento');
		const plan = NATIVE[req.timeframe];
		const isOption = req.instrument.type === 'option';
		const dataset = isOption
			? (ctx.options['optionsDataset'] ?? 'OPRA.PILLAR')
			: (ctx.options['dataset'] ?? 'EQUS.MINI');
		const symbol =
			req.instrument.type === 'equity' ? req.instrument.symbol : formatOcc(req.instrument.contract);
		const body = new URLSearchParams({
			dataset,
			symbols: symbol,
			schema: plan.schema,
			start: new Date(req.from).toISOString(),
			end: new Date(req.to).toISOString(),
			stype_in: 'raw_symbol',
			encoding: 'json',
			compression: 'none'
		});
		const res = await ctx.fetch('https://hist.databento.com/v0/timeseries.get_range', {
			method: 'POST',
			headers: {
				Authorization: `Basic ${base64(`${key}:`)}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: body.toString(),
			signal: ctx.signal ?? null
		});
		if (!res.ok) throw await errorFromResponse('Databento', res);
		const text = await res.text();
		const bars: Bar[] = [];
		for (const line of text.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			let rec: DbnOhlcv;
			try {
				rec = JSON.parse(trimmed) as DbnOhlcv;
			} catch {
				throw new ProviderError('parse', 'Databento returned a malformed record');
			}
			bars.push({
				time: nanosToSeconds(rec.hd?.ts_event ?? rec.ts_event),
				open: price(rec.open),
				high: price(rec.high),
				low: price(rec.low),
				close: price(rec.close),
				volume: Number(rec.volume)
			});
		}
		bars.sort((a, b) => a.time - b.time);
		return plan.resampleTo ? resample(bars, plan.resampleTo) : bars;
	}
};
