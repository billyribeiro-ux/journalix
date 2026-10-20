import type { ProviderId, ProviderSecret } from '../domain/schemas.ts';
import type { OptionContractRef } from '../options/occ.ts';

/** OHLCV bar. `time` is the bar's open, in UTC seconds (Lightweight Charts' native unit). */
export interface Bar {
	readonly time: number;
	readonly open: number;
	readonly high: number;
	readonly low: number;
	readonly close: number;
	readonly volume: number;
}

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_SECONDS: Readonly<Record<Timeframe, number>> = {
	'1m': 60,
	'5m': 300,
	'15m': 900,
	'30m': 1800,
	'1h': 3600,
	'4h': 14_400,
	'1D': 86_400,
	'1W': 604_800
};

export const TIMEFRAME_LABELS: Readonly<Record<Timeframe, string>> = {
	'1m': '1 min',
	'5m': '5 min',
	'15m': '15 min',
	'30m': '30 min',
	'1h': '1 hour',
	'4h': '4 hours',
	'1D': 'Daily',
	'1W': 'Weekly'
};

export type Instrument =
	| { readonly type: 'equity'; readonly symbol: string }
	| { readonly type: 'option'; readonly contract: OptionContractRef };

export interface BarsRequest {
	readonly instrument: Instrument;
	readonly timeframe: Timeframe;
	/** Inclusive range, UTC milliseconds. */
	readonly from: number;
	readonly to: number;
	/**
	 * Known prices (e.g. fills) the simulated provider bridges through. Real providers ignore it.
	 */
	readonly anchors?: readonly { readonly time: number; readonly price: number }[];
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProviderContext {
	readonly secret: ProviderSecret;
	readonly options: Readonly<Record<string, string>>;
	readonly fetch: FetchLike;
	readonly signal?: AbortSignal;
}

export interface ProviderField {
	readonly name: string;
	readonly label: string;
	readonly kind: 'secret' | 'select' | 'text';
	readonly required: boolean;
	readonly help?: string;
	readonly placeholder?: string;
	readonly choices?: readonly { readonly value: string; readonly label: string }[];
	readonly defaultValue?: string;
}

export interface MarketDataProvider {
	readonly id: ProviderId;
	readonly name: string;
	readonly description: string;
	readonly website: string;
	readonly docs: string;
	/** Fields the user fills in under Settings → Market data. */
	readonly fields: readonly ProviderField[];
	readonly supportsOptions: boolean;
	readonly timeframes: readonly Timeframe[];
	/** Note shown in settings about cost, delay or coverage. */
	readonly notice?: string;
	fetchBars(request: BarsRequest, ctx: ProviderContext): Promise<Bar[]>;
}

export type ProviderErrorCode =
	| 'unauthorized'
	| 'forbidden'
	| 'rate_limited'
	| 'not_found'
	| 'unsupported'
	| 'invalid_request'
	| 'upstream'
	| 'network'
	| 'parse';

export class ProviderError extends Error {
	readonly code: ProviderErrorCode;
	readonly status: number | null;

	constructor(code: ProviderErrorCode, message: string, status: number | null = null) {
		super(message);
		this.name = 'ProviderError';
		this.code = code;
		this.status = status;
	}
}

/** Maps an HTTP failure to a typed provider error with a short, safe message. */
/** Raised when a provider still has pages left after the adapter's page cap. */
export function tooManyBars(provider: string): ProviderError {
	return new ProviderError(
		'invalid_request',
		`${provider} has more bars for this window than one request loads. Choose a larger timeframe.`
	);
}

export async function errorFromResponse(provider: string, res: Response): Promise<ProviderError> {
	const detail = await res
		.text()
		.then((text) => text.slice(0, 300).replace(/\s+/g, ' ').trim())
		.catch(() => '');
	const suffix = detail ? ` — ${detail}` : '';
	switch (res.status) {
		case 401:
			return new ProviderError('unauthorized', `${provider} rejected the API key${suffix}`, 401);
		case 403:
			return new ProviderError(
				'forbidden',
				`${provider} plan does not include this data${suffix}`,
				403
			);
		case 404:
			return new ProviderError(
				'not_found',
				`${provider} has no data for this symbol${suffix}`,
				404
			);
		case 422:
		case 400:
			return new ProviderError(
				'invalid_request',
				`${provider} rejected the request${suffix}`,
				res.status
			);
		case 429:
			return new ProviderError(
				'rate_limited',
				`${provider} rate limit reached; try again shortly`,
				429
			);
		default:
			return new ProviderError(
				'upstream',
				`${provider} returned HTTP ${res.status}${suffix}`,
				res.status
			);
	}
}

export function requireSecret(ctx: ProviderContext, field: string, provider: string): string {
	const value = ctx.secret[field];
	if (!value) throw new ProviderError('unauthorized', `${provider}: missing ${field}`);
	return value;
}
