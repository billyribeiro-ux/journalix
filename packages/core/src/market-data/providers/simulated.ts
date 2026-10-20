import { bucketStart } from '../timeframes.ts';
import { TIMEFRAME_SECONDS, type Bar, type MarketDataProvider } from '../types.ts';

/**
 * Deterministic synthetic prices for demos and offline testing. Bars follow a seeded random walk
 * that is bridged through any anchor prices (the trade's fills), so markers land on the candles.
 * Never real market data — the UI labels it as simulated everywhere it appears.
 */
function hash(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function gaussian(rand: () => number): number {
	const u = Math.max(1e-12, rand());
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function isRegularSession(timeSec: number, intraday: boolean): boolean {
	const d = new Date(timeSec * 1000);
	const ny = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		hourCycle: 'h23',
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(d);
	const wd = ny.find((p) => p.type === 'weekday')?.value;
	if (wd === 'Sat' || wd === 'Sun') return false;
	if (!intraday) return true;
	const h = Number(ny.find((p) => p.type === 'hour')?.value);
	const m = Number(ny.find((p) => p.type === 'minute')?.value);
	const minutes = h * 60 + m;
	return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export const simulated: MarketDataProvider = {
	id: 'simulated',
	name: 'Simulated (demo)',
	description:
		'Synthetic candles that pass through your fills. For demos and testing — not market data.',
	website: '',
	docs: '',
	supportsOptions: true,
	timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'],
	fields: [],
	notice: 'Prices are generated, not real. Use a real provider for actual market data.',
	async fetchBars(req) {
		const step = TIMEFRAME_SECONDS[req.timeframe];
		const intraday = step < 86_400;
		const start = bucketStart(Math.floor(req.from / 1000), req.timeframe);
		const end = Math.floor(req.to / 1000);
		const key =
			req.instrument.type === 'equity'
				? req.instrument.symbol
				: `${req.instrument.contract.underlying}${req.instrument.contract.strike}${req.instrument.contract.kind}`;
		const rand = mulberry32(hash(`${key}:${req.timeframe}:${start}`));

		const anchors = [...(req.anchors ?? [])].sort((a, b) => a.time - b.time);
		const basePrice = anchors[0]?.price ?? 50 + (hash(key) % 400);
		const times: number[] = [];
		for (let t = start; t <= end && times.length < 20_000; t += step) {
			if (isRegularSession(t, intraday)) times.push(t);
		}
		if (times.length === 0) return [];

		// Random walk in log space, then a Brownian-bridge correction through each anchor.
		const vol = (intraday ? 0.0018 : 0.016) * Math.sqrt(step / (intraday ? 300 : 86_400));
		const walk: number[] = [Math.log(basePrice)];
		for (let i = 1; i < times.length; i++) walk.push((walk[i - 1] ?? 0) + vol * gaussian(rand));

		const closes = walk.map((x) => Math.exp(x));
		const anchorIdx = anchors
			.map((a) => {
				const sec = Math.floor(a.time / 1000);
				let idx = times.findIndex((t) => t + step > sec);
				if (idx < 0) idx = times.length - 1;
				return { idx, price: a.price };
			})
			.filter((a, i, arr) => arr.findIndex((b) => b.idx === a.idx) === i);
		if (anchorIdx.length > 0) {
			const ratios = anchorIdx.map((a) => Math.log(a.price / (closes[a.idx] ?? a.price)));
			for (let i = 0; i < closes.length; i++) {
				let adj: number;
				const firstA = anchorIdx[0];
				const lastA = anchorIdx[anchorIdx.length - 1];
				if (!firstA || !lastA) adj = 0;
				else if (i <= firstA.idx) adj = ratios[0] ?? 0;
				else if (i >= lastA.idx) adj = ratios[ratios.length - 1] ?? 0;
				else {
					const k = anchorIdx.findIndex((a) => a.idx >= i);
					const a0 = anchorIdx[k - 1];
					const a1 = anchorIdx[k];
					if (!a0 || !a1) adj = 0;
					else {
						const w = (i - a0.idx) / Math.max(1, a1.idx - a0.idx);
						adj = (ratios[k - 1] ?? 0) * (1 - w) + (ratios[k] ?? 0) * w;
					}
				}
				closes[i] = (closes[i] ?? 0) * Math.exp(adj);
			}
		}

		const bars: Bar[] = [];
		for (let i = 0; i < times.length; i++) {
			const close = closes[i] ?? basePrice;
			const open = i === 0 ? close * (1 + vol * gaussian(rand) * 0.3) : (closes[i - 1] ?? close);
			const wick = Math.abs(gaussian(rand)) * vol * 0.6 * close;
			const anchorHere = anchors.filter((a) => {
				const sec = Math.floor(a.time / 1000);
				return sec >= (times[i] ?? 0) && sec < (times[i] ?? 0) + step;
			});
			const highs = [open, close, ...anchorHere.map((a) => a.price)];
			const high = Math.max(...highs) + wick;
			const low = Math.max(0.01, Math.min(...highs) - Math.abs(gaussian(rand)) * vol * 0.6 * close);
			const volume = Math.round((intraday ? 40_000 : 6_000_000) * (0.4 + rand() * 1.6));
			bars.push({ time: times[i] ?? 0, open, high, low, close, volume });
		}
		return bars;
	}
};
