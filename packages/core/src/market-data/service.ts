/**
 * Bars service shared by the web server and the desktop app: resolves the configured provider,
 * serves from cache when the window is already stored, otherwise fetches, normalises and caches.
 */
import type { ProviderConfigView, ProviderSecret } from '../domain/schemas.ts';
import { getProvider } from './registry.ts';
import { normalizeBars } from './timeframes.ts';
import {
	ProviderError,
	type Bar,
	type BarsRequest,
	type FetchLike,
	type Instrument,
	type ProviderErrorCode,
	type Timeframe
} from './types.ts';
import { formatOccCompact } from '../options/occ.ts';

export interface ResolvedProvider {
	readonly config: ProviderConfigView;
	readonly secret: ProviderSecret;
}

export interface BarsCacheKey {
	readonly provider: string;
	readonly instrument: string;
	readonly timeframe: Timeframe;
}

export interface BarsCache {
	/** Returns stored bars if [from, to] is fully covered by earlier fetches, otherwise `null`. */
	read(key: BarsCacheKey, from: number, to: number): Promise<Bar[] | null>;
	write(key: BarsCacheKey, bars: readonly Bar[], from: number, to: number): Promise<void>;
}

export type BarsResult =
	| {
			readonly status: 'ok';
			readonly bars: readonly Bar[];
			readonly provider: {
				readonly id: string;
				readonly label: string;
				readonly simulated: boolean;
			};
			readonly timeframe: Timeframe;
			readonly cached: boolean;
	  }
	| { readonly status: 'no-provider' }
	| { readonly status: 'error'; readonly code: ProviderErrorCode; readonly message: string };

export interface BarsServiceDeps {
	/** Provider to use: the requested id, or the user's default when `id` is null. */
	resolve(id: string | null): Promise<ResolvedProvider | null>;
	readonly cache?: BarsCache;
	readonly fetch: FetchLike;
	readonly now?: () => number;
}

export function instrumentKey(instrument: Instrument): string {
	return instrument.type === 'equity' ? instrument.symbol : formatOccCompact(instrument.contract);
}

/** Recent windows may still be forming, so they are never marked as covered. */
const FRESH_MS = 20 * 60_000;

export function createBarsService(deps: BarsServiceDeps) {
	const now = deps.now ?? Date.now;

	return {
		async get(
			request: BarsRequest,
			providerId: string | null = null,
			signal?: AbortSignal
		): Promise<BarsResult> {
			const resolved = await deps.resolve(providerId);
			if (!resolved) return { status: 'no-provider' };
			const provider = getProvider(resolved.config.provider);
			const meta = {
				id: resolved.config.id,
				label: resolved.config.label,
				simulated: provider.id === 'simulated'
			};

			if (request.instrument.type === 'option' && !provider.supportsOptions) {
				return {
					status: 'error',
					code: 'unsupported',
					message: `${provider.name} does not provide options bars`
				};
			}
			const to = Math.min(request.to, now());
			if (!(to > request.from))
				return { status: 'error', code: 'invalid_request', message: 'Empty time window' };

			const key: BarsCacheKey = {
				provider: resolved.config.id,
				instrument: instrumentKey(request.instrument),
				timeframe: request.timeframe
			};
			const cacheable = deps.cache !== undefined && provider.id !== 'simulated';
			if (cacheable && deps.cache) {
				const hit = await deps.cache.read(key, request.from, to);
				if (hit && hit.length > 0)
					return {
						status: 'ok',
						bars: hit,
						provider: meta,
						timeframe: request.timeframe,
						cached: true
					};
			}

			try {
				const raw = await provider.fetchBars(
					{ ...request, to },
					{
						secret: resolved.secret,
						options: resolved.config.options,
						fetch: deps.fetch,
						...(signal ? { signal } : {})
					}
				);
				const bars = normalizeBars(raw, request.from, to);
				if (cacheable && deps.cache && bars.length > 0) {
					const coveredTo = Math.min(to, now() - FRESH_MS);
					if (coveredTo > request.from) await deps.cache.write(key, bars, request.from, coveredTo);
				}
				return { status: 'ok', bars, provider: meta, timeframe: request.timeframe, cached: false };
			} catch (error) {
				if (error instanceof ProviderError)
					return { status: 'error', code: error.code, message: error.message };
				if (error instanceof DOMException && error.name === 'AbortError') {
					return { status: 'error', code: 'network', message: 'Request cancelled' };
				}
				const message = error instanceof Error ? error.message : 'Unknown error';
				return {
					status: 'error',
					code: 'network',
					message: `Could not reach the provider: ${message}`
				};
			}
		}
	};
}

export type BarsService = ReturnType<typeof createBarsService>;
