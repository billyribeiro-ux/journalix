import { describe, expect, it } from 'vitest';
import { massive } from '../market-data/providers/massive.ts';
import { alpaca } from '../market-data/providers/alpaca.ts';
import { tiingo } from '../market-data/providers/tiingo.ts';
import { databento } from '../market-data/providers/databento.ts';
import { simulated } from '../market-data/providers/simulated.ts';
import { chooseTimeframe, resample, windowFor } from '../market-data/timeframes.ts';
import { createBarsService, type BarsCache } from '../market-data/service.ts';
import type { FetchLike } from '../market-data/types.ts';
import type { ProviderConfigView } from '../domain/schemas.ts';

interface Call {
	url: string;
	init: RequestInit | undefined;
}

function mockFetch(
	responses: (string | object)[],
	status = 200
): { fetch: FetchLike; calls: Call[] } {
	const calls: Call[] = [];
	let i = 0;
	const fetch: FetchLike = async (url, init) => {
		calls.push({ url, init });
		const body = responses[Math.min(i++, responses.length - 1)];
		return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
	};
	return { fetch, calls };
}

const req = {
	instrument: { type: 'equity', symbol: 'SPY' },
	timeframe: '5m',
	from: Date.parse('2026-10-01T13:30:00Z'),
	to: Date.parse('2026-10-01T20:00:00Z')
} as const;

describe('provider adapters', () => {
	it('Massive: builds the aggregates URL, follows next_url and maps fields', async () => {
		const { fetch, calls } = mockFetch([
			{
				status: 'OK',
				results: [{ t: 1_759_325_400_000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }],
				next_url: 'https://api.massive.com/v2/aggs/next?cursor=abc'
			},
			{ status: 'OK', results: [{ t: 1_759_325_700_000, o: 1.5, h: 2, l: 1, c: 1.8, v: 5 }] }
		]);
		const bars = await massive.fetchBars(req, { secret: { apiKey: 'k' }, options: {}, fetch });
		expect(calls[0]?.url).toMatch(
			/^https:\/\/api\.massive\.com\/v2\/aggs\/ticker\/SPY\/range\/5\/minute\/\d+\/\d+\?.*apiKey=k/
		);
		expect(calls[1]?.url).toContain('cursor=abc');
		expect(calls[1]?.url).toContain('apiKey=k');
		expect(bars).toEqual([
			{ time: 1_759_325_400, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
			{ time: 1_759_325_700, open: 1.5, high: 2, low: 1, close: 1.8, volume: 5 }
		]);
	});

	it('Massive: never sends the key to a next_url on another host', async () => {
		const { fetch, calls } = mockFetch([
			{ status: 'OK', results: [], next_url: 'https://evil.example/v2/aggs/next?cursor=abc' }
		]);
		await expect(
			massive.fetchBars(req, { secret: { apiKey: 'k' }, options: {}, fetch })
		).rejects.toMatchObject({ code: 'upstream' });
		expect(calls).toHaveLength(1);
	});

	it('Massive: fails instead of returning a truncated window', async () => {
		const { fetch, calls } = mockFetch([
			{ status: 'OK', results: [], next_url: 'https://api.massive.com/v2/aggs/next?cursor=more' }
		]);
		await expect(
			massive.fetchBars(req, { secret: { apiKey: 'k' }, options: {}, fetch })
		).rejects.toMatchObject({ code: 'invalid_request' });
		expect(calls).toHaveLength(20);
	});

	it('Alpaca: fails instead of returning a truncated window', async () => {
		const { fetch } = mockFetch([{ bars: { SPY: [] }, next_page_token: 'more' }]);
		await expect(
			alpaca.fetchBars(req, { secret: { apiKey: 'k', apiSecret: 's' }, options: {}, fetch })
		).rejects.toMatchObject({ code: 'invalid_request' });
	});

	it('Massive: prefixes option tickers with O:', async () => {
		const { fetch, calls } = mockFetch([{ status: 'OK', results: [] }]);
		await massive.fetchBars(
			{
				...req,
				instrument: {
					type: 'option',
					contract: { underlying: 'SPY', expiration: '2026-12-18', kind: 'put', strike: 600 }
				}
			},
			{ secret: { apiKey: 'k' }, options: {}, fetch }
		);
		expect(calls[0]?.url).toContain('/ticker/O%3ASPY261218P00600000/');
	});

	it('Alpaca: sends key headers and paginates', async () => {
		const { fetch, calls } = mockFetch([
			{
				bars: { SPY: [{ t: '2026-10-01T13:30:00Z', o: 1, h: 2, l: 1, c: 2, v: 9 }] },
				next_page_token: 'p2'
			},
			{
				bars: { SPY: [{ t: '2026-10-01T13:35:00Z', o: 2, h: 3, l: 2, c: 3, v: 4 }] },
				next_page_token: null
			}
		]);
		const bars = await alpaca.fetchBars(req, {
			secret: { apiKey: 'id', apiSecret: 'sec' },
			options: { feed: 'iex' },
			fetch
		});
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers['APCA-API-KEY-ID']).toBe('id');
		expect(headers['APCA-API-SECRET-KEY']).toBe('sec');
		expect(calls[0]?.url).toContain('/v2/stocks/bars?');
		expect(calls[0]?.url).toContain('timeframe=5Min');
		expect(calls[0]?.url).toContain('feed=iex');
		expect(calls[1]?.url).toContain('page_token=p2');
		expect(bars).toHaveLength(2);
	});

	it('Tiingo: uses the IEX endpoint with a Token header', async () => {
		const { fetch, calls } = mockFetch([
			[{ date: '2026-10-01T13:30:00.000Z', open: 1, high: 2, low: 1, close: 2, volume: 3 }]
		]);
		const bars = await tiingo.fetchBars(req, { secret: { apiKey: 'tok' }, options: {}, fetch });
		expect(calls[0]?.url).toContain('https://api.tiingo.com/iex/spy/prices?');
		expect(calls[0]?.url).toContain('resampleFreq=5min');
		expect((calls[0]?.init?.headers as Record<string, string>)['Authorization']).toBe('Token tok');
		expect(bars[0]?.time).toBe(Date.parse('2026-10-01T13:30:00Z') / 1000);
	});

	it('Databento: posts with Basic auth and decodes fixed-point JSON lines', async () => {
		const lines = [
			{
				hd: { ts_event: '1759325400000000000', rtype: 33 },
				open: '1000000000',
				high: '2000000000',
				low: '500000000',
				close: '1500000000',
				volume: '7'
			},
			{
				hd: { ts_event: '1759325460000000000', rtype: 33 },
				open: '1500000000',
				high: '2500000000',
				low: '1000000000',
				close: '2000000000',
				volume: '3'
			}
		]
			.map((l) => JSON.stringify(l))
			.join('\n');
		const { fetch, calls } = mockFetch([lines]);
		const bars = await databento.fetchBars(req, {
			secret: { apiKey: 'db-key' },
			options: {},
			fetch
		});
		expect(calls[0]?.url).toBe('https://hist.databento.com/v0/timeseries.get_range');
		expect(calls[0]?.init?.method).toBe('POST');
		expect((calls[0]?.init?.headers as Record<string, string>)['Authorization']).toBe(
			`Basic ${btoa('db-key:')}`
		);
		const body = new URLSearchParams(String(calls[0]?.init?.body));
		expect(body.get('schema')).toBe('ohlcv-1m');
		expect(body.get('dataset')).toBe('EQUS.MINI');
		expect(body.get('encoding')).toBe('json');
		// Two 1-minute bars resampled into one 5-minute bar.
		expect(bars).toEqual([
			{ time: 1_759_325_400, open: 1, high: 2.5, low: 0.5, close: 2, volume: 10 }
		]);
	});

	it('maps HTTP 401 to an unauthorized provider error', async () => {
		const { fetch } = mockFetch([{ message: 'bad key' }], 401);
		await expect(
			massive.fetchBars(req, { secret: { apiKey: 'x' }, options: {}, fetch })
		).rejects.toMatchObject({ code: 'unauthorized' });
	});

	it('simulated bars pass through anchors and are deterministic', async () => {
		const anchors = [
			{ time: Date.parse('2026-10-01T14:02:00Z'), price: 600 },
			{ time: Date.parse('2026-10-01T17:31:00Z'), price: 606 }
		];
		const a = await simulated.fetchBars(
			{ ...req, anchors },
			{ secret: {}, options: {}, fetch: globalThis.fetch }
		);
		const b = await simulated.fetchBars(
			{ ...req, anchors },
			{ secret: {}, options: {}, fetch: globalThis.fetch }
		);
		expect(a).toEqual(b);
		const at = a.find((x) => x.time === Date.parse('2026-10-01T14:00:00Z') / 1000);
		expect(at?.close).toBeCloseTo(600, 6);
		expect(at && at.high >= 600 && at.low <= 600).toBe(true);
	});
});

describe('timeframes', () => {
	it('chooses a bar size for the hold time', () => {
		expect(chooseTimeframe(30 * 60_000)).toBe('1m');
		expect(chooseTimeframe(3 * 3_600_000)).toBe('5m');
		expect(chooseTimeframe(5 * 86_400_000)).toBe('1h');
		expect(chooseTimeframe(60 * 86_400_000)).toBe('1D');
	});
	it('pads the window and never goes into the future', () => {
		const w = windowFor(1_000_000, 2_000_000, '1m', 2_100_000);
		expect(w.from).toBeLessThan(1_000_000);
		expect(w.to).toBe(2_100_000);
	});
	it('keeps a valid window when fills are ahead of the clock', () => {
		const w = windowFor(5_000_000, null, '1m', 4_000_000);
		expect(w.to).toBeGreaterThan(w.from);
		expect(w.to).toBeGreaterThanOrEqual(5_000_000 + 60_000);
	});
	it('resamples OHLCV correctly', () => {
		const out = resample(
			[
				{ time: 0, open: 1, high: 3, low: 1, close: 2, volume: 1 },
				{ time: 60, open: 2, high: 4, low: 0.5, close: 3, volume: 2 },
				{ time: 300, open: 3, high: 3, low: 3, close: 3, volume: 5 }
			],
			'5m'
		);
		expect(out).toEqual([
			{ time: 0, open: 1, high: 4, low: 0.5, close: 3, volume: 3 },
			{ time: 300, open: 3, high: 3, low: 3, close: 3, volume: 5 }
		]);
	});
});

describe('bars service', () => {
	const config: ProviderConfigView = {
		id: '0192f5a0-0000-7000-8000-0000000000aa',
		provider: 'massive',
		label: 'Massive',
		options: {},
		isDefault: true,
		secretHint: '••••ab12',
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z'
	};

	it('reports no-provider when nothing is configured', async () => {
		const svc = createBarsService({ resolve: async () => null, fetch: globalThis.fetch });
		expect(await svc.get(req)).toEqual({ status: 'no-provider' });
	});

	it('caches completed windows and serves the next request from cache', async () => {
		const store = new Map<string, unknown>();
		const cache: BarsCache = {
			async read(key) {
				return (store.get(JSON.stringify(key)) as never) ?? null;
			},
			async write(key, bars) {
				store.set(JSON.stringify(key), bars);
			}
		};
		const { fetch, calls } = mockFetch([
			{ status: 'OK', results: [{ t: req.from, o: 1, h: 1, l: 1, c: 1, v: 1 }] }
		]);
		const svc = createBarsService({
			resolve: async () => ({ config, secret: { apiKey: 'k' } }),
			cache,
			fetch,
			now: () => req.to + 86_400_000
		});
		const first = await svc.get(req);
		const second = await svc.get(req);
		expect(first.status === 'ok' && first.cached).toBe(false);
		expect(second.status === 'ok' && second.cached).toBe(true);
		expect(calls).toHaveLength(1);
	});

	it('returns a typed error instead of throwing', async () => {
		const { fetch } = mockFetch(['nope'], 500);
		const svc = createBarsService({
			resolve: async () => ({ config, secret: { apiKey: 'k' } }),
			fetch
		});
		const result = await svc.get(req);
		expect(result.status).toBe('error');
	});
});
