import * as v from 'valibot';
import { IsoDateSchema, SymbolSchema } from '../domain/schemas.ts';
import { TIMEFRAMES } from './types.ts';

export const TimeframeSchema = v.picklist(TIMEFRAMES);

export const ProviderErrorCodeSchema = v.picklist([
	'unauthorized',
	'forbidden',
	'rate_limited',
	'not_found',
	'unsupported',
	'invalid_request',
	'upstream',
	'network',
	'parse'
]);

const MAX_WINDOW_MS = 5 * 366 * 86_400_000;

/** Validates bars requests that cross a trust boundary (HTTP or IPC). */
export const BarsRequestSchema = v.pipe(
	v.object({
		instrument: v.variant('type', [
			v.object({ type: v.literal('equity'), symbol: SymbolSchema }),
			v.object({
				type: v.literal('option'),
				contract: v.object({
					underlying: SymbolSchema,
					expiration: IsoDateSchema,
					kind: v.picklist(['call', 'put']),
					strike: v.pipe(v.number(), v.finite(), v.gtValue(0))
				})
			})
		]),
		timeframe: TimeframeSchema,
		from: v.pipe(v.number(), v.integer(), v.minValue(0)),
		to: v.pipe(v.number(), v.integer(), v.minValue(0)),
		anchors: v.optional(
			v.pipe(
				v.array(
					v.object({
						time: v.pipe(v.number(), v.finite()),
						price: v.pipe(v.number(), v.finite(), v.gtValue(0))
					})
				),
				v.maxLength(2000)
			)
		)
	}),
	v.check((r) => r.to > r.from, 'The window must end after it starts'),
	v.check((r) => r.to - r.from <= MAX_WINDOW_MS, 'The window is longer than five years')
);

export const BarSchema = v.object({
	time: v.number(),
	open: v.number(),
	high: v.number(),
	low: v.number(),
	close: v.number(),
	volume: v.number()
});

/** Validates a bars-service result received over HTTP or IPC. */
export const BarsResultSchema = v.variant('status', [
	v.object({
		status: v.literal('ok'),
		bars: v.array(BarSchema),
		provider: v.object({ id: v.string(), label: v.string(), simulated: v.boolean() }),
		timeframe: TimeframeSchema,
		cached: v.boolean()
	}),
	v.object({ status: v.literal('no-provider') }),
	v.object({ status: v.literal('error'), code: ProviderErrorCodeSchema, message: v.string() })
]);
