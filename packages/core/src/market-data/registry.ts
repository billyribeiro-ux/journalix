import type { ProviderId } from '../domain/schemas.ts';
import type { MarketDataProvider } from './types.ts';
import { massive } from './providers/massive.ts';
import { alpaca } from './providers/alpaca.ts';
import { tiingo } from './providers/tiingo.ts';
import { databento } from './providers/databento.ts';
import { simulated } from './providers/simulated.ts';

export const PROVIDERS: Readonly<Record<ProviderId, MarketDataProvider>> = {
	massive,
	alpaca,
	tiingo,
	databento,
	simulated
};

/** Order shown in Settings: real data first, the simulator last. */
export const PROVIDER_ORDER: readonly ProviderId[] = [
	'massive',
	'alpaca',
	'databento',
	'tiingo',
	'simulated'
];

export function getProvider(id: ProviderId): MarketDataProvider {
	return PROVIDERS[id];
}
