/**
 * Deterministic sample journal for demos, screenshots and end-to-end tests.
 *
 * Option premiums are priced with Black-Scholes from a simulated underlying path, and every
 * fill records the underlying price, so Greeks, IV and payoff analysis work on sample data
 * exactly as they do on real trades.
 */
import type {
	Account,
	Execution,
	JournalExport,
	Leg,
	Note,
	Playbook,
	PriceLevel,
	Tag,
	Trade,
	UserSettings
} from '../domain/schemas.ts';
import { DEFAULT_SETTINGS } from '../domain/schemas.ts';
import { blackScholes, expiryInstant, yearsBetween } from '../options/black-scholes.ts';
import { newId } from '../util/id.ts';
import { round } from '../util/math.ts';

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

interface Rng {
	next(): number;
	normal(): number;
	pick<T>(items: readonly T[]): T;
	int(min: number, max: number): number;
	chance(p: number): boolean;
}

function rng(seed: number): Rng {
	const r = mulberry32(seed);
	return {
		next: r,
		normal() {
			const u = Math.max(1e-12, r());
			return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
		},
		pick(items) {
			const item = items[Math.floor(r() * items.length)];
			if (item === undefined) throw new Error('pick from empty list');
			return item;
		},
		int(min, max) {
			return min + Math.floor(r() * (max - min + 1));
		},
		chance(p) {
			return r() < p;
		}
	};
}

const UNDERLYINGS: readonly { symbol: string; price: number; iv: number; step: number }[] = [
	{ symbol: 'SPY', price: 672, iv: 0.16, step: 1 },
	{ symbol: 'QQQ', price: 598, iv: 0.2, step: 1 },
	{ symbol: 'IWM', price: 241, iv: 0.22, step: 1 },
	{ symbol: 'AAPL', price: 248, iv: 0.26, step: 2.5 },
	{ symbol: 'NVDA', price: 186, iv: 0.42, step: 2.5 },
	{ symbol: 'TSLA', price: 438, iv: 0.55, step: 5 },
	{ symbol: 'AMD', price: 214, iv: 0.48, step: 2.5 },
	{ symbol: 'MSFT', price: 512, iv: 0.24, step: 5 },
	{ symbol: 'META', price: 716, iv: 0.33, step: 5 },
	{ symbol: 'AMZN', price: 221, iv: 0.31, step: 2.5 }
];

const RATE = 0.04;
const NY = 'America/New_York';

/** An instant on a given New York trading day at hh:mm. */
function nyInstant(day: string, hour: number, minute: number): number {
	const guess = Date.parse(
		`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`
	);
	const shown = new Intl.DateTimeFormat('en-US', {
		timeZone: NY,
		hourCycle: 'h23',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(guess));
	const [h, m] = shown.split(':').map(Number);
	return guess + ((hour - (h ?? 0)) * 60 + (minute - (m ?? 0))) * 60_000;
}

function tradingDays(endDay: string, count: number): string[] {
	const days: string[] = [];
	let t = Date.parse(`${endDay}T12:00:00Z`);
	while (days.length < count) {
		const wd = new Date(t).getUTCDay();
		if (wd !== 0 && wd !== 6) days.unshift(new Date(t).toISOString().slice(0, 10));
		t -= 86_400_000;
	}
	return days;
}

/** Next Friday on or after `day` plus `weeks`. */
function fridayAfter(day: string, minDays: number): string {
	let t = Date.parse(`${day}T12:00:00Z`) + minDays * 86_400_000;
	while (new Date(t).getUTCDay() !== 5) t += 86_400_000;
	return new Date(t).toISOString().slice(0, 10);
}

function strikeNear(price: number, step: number, offset = 0): number {
	return round(Math.round(price / step) * step + offset * step, 2);
}

interface LegSpec {
	readonly kind: 'stock' | 'call' | 'put';
	readonly strike: number | null;
	readonly expiration: string | null;
	/** + long, − short (contracts or shares) */
	readonly qty: number;
}

function premium(spec: LegSpec, spot: number, at: number, iv: number): number {
	if (spec.kind === 'stock') return round(spot, 2);
	const years = yearsBetween(at, expiryInstant(spec.expiration ?? ''));
	const p = blackScholes({
		right: spec.kind,
		spot,
		strike: spec.strike ?? spot,
		years,
		rate: RATE,
		volatility: iv
	}).price;
	return Math.max(0.01, round(p, 2));
}

export interface SampleJournalOptions {
	/** Last trading day included. Defaults to today (UTC). */
	readonly endDay?: string;
	readonly seed?: number;
	readonly tradingDays?: number;
	/**
	 * Fills, levels and notes after this instant are dropped, so a sample generated during the
	 * session never contains future executions. Defaults to the current time.
	 */
	readonly now?: number;
}

export function createSampleJournal(options: SampleJournalOptions = {}): JournalExport {
	const r = rng(options.seed ?? 20_261_020);
	const endDay = options.endDay ?? new Date().toISOString().slice(0, 10);
	const days = tradingDays(endDay, options.tradingDays ?? 130);
	const firstDay = days[0] ?? endDay;
	const createdAt = new Date(nyInstant(firstDay, 8, 0) - 7 * 86_400_000).toISOString();

	const main: Account = {
		id: newId(Date.parse(createdAt)),
		name: 'Main margin',
		broker: 'Interactive Brokers',
		currency: 'USD',
		startingBalance: 50_000,
		archived: false,
		createdAt
	};
	const ira: Account = {
		id: newId(Date.parse(createdAt) + 1),
		name: 'Roth IRA',
		broker: 'Schwab',
		currency: 'USD',
		startingBalance: 25_000,
		archived: false,
		createdAt
	};

	const tag = (name: string, category: Tag['category'], color: string): Tag => ({
		id: newId(),
		name,
		category,
		color
	});
	const tags: Tag[] = [
		tag('A+ setup', 'setup', '#3fb68b'),
		tag('Opening range', 'setup', '#4c8dff'),
		tag('VWAP reclaim', 'setup', '#6f7dff'),
		tag('Earnings', 'market', '#c08a2b'),
		tag('Trend day', 'market', '#2f9e9e'),
		tag('FOMC / CPI', 'market', '#b06ab3'),
		tag('FOMO entry', 'mistake', '#e5534b'),
		tag('Moved stop', 'mistake', '#f0883e'),
		tag('Oversized', 'mistake', '#d4513b'),
		tag('Early exit', 'mistake', '#cf8e3e'),
		tag('Calm', 'emotion', '#59a96a'),
		tag('Revenge', 'emotion', '#c94f6d')
	];
	const tagByName = new Map(tags.map((t) => [t.name, t.id]));

	const playbook = (
		name: string,
		color: string,
		description: string,
		rules: string[]
	): Playbook => ({
		id: newId(),
		name,
		description,
		rules,
		color,
		archived: false,
		createdAt
	});
	const playbooks: Playbook[] = [
		playbook(
			'Opening range breakout',
			'#4c8dff',
			'Trade the break of the first 15-minute range with the trend.',
			[
				'Wait for the 15-minute range to complete',
				'Enter on a close outside the range with volume',
				'Stop on the opposite side of the range midpoint',
				'Take half at 1R, trail the rest'
			]
		),
		playbook(
			'Premium harvest',
			'#3fb68b',
			'Sell defined-risk premium 30–45 DTE when IV rank is elevated.',
			[
				'IV rank above 30',
				'Short strikes outside the expected move',
				'Close at 50% of max profit',
				'Manage or roll at 21 DTE'
			]
		),
		playbook(
			'0DTE momentum',
			'#c94f6d',
			'Same-day options on SPY/QQQ in the direction of the trend.',
			[
				'Only after 10:00 ET',
				'Trade with VWAP and the 9 EMA aligned',
				'Risk no more than 0.5% of the account',
				'Hard exit by 15:30 ET'
			]
		),
		playbook(
			'Swing pullback',
			'#c08a2b',
			'Buy pullbacks to the 20-day moving average in leading stocks.',
			[
				'Stock above the 50-day moving average',
				'Pullback on lighter volume',
				'Stop below the swing low',
				'Target the prior high'
			]
		)
	];
	const [orb, harvest, zeroDte, swing] = playbooks as [Playbook, Playbook, Playbook, Playbook];

	const trades: Trade[] = [];
	const notes: Note[] = [];
	const spot = new Map(UNDERLYINGS.map((u) => [u.symbol, u.price]));

	days.forEach((day, dayIndex) => {
		// Drift every underlying day to day.
		for (const u of UNDERLYINGS) {
			const prev = spot.get(u.symbol) ?? u.price;
			spot.set(u.symbol, prev * Math.exp(0.0002 + (u.iv / Math.sqrt(252)) * r.normal()));
		}
		const count = r.chance(0.18) ? 0 : r.int(1, 3);
		if (count > 0 && r.chance(0.35)) {
			notes.push({
				id: newId(nyInstant(day, 8, 30)),
				date: day,
				title: 'Pre-market plan',
				kind: 'premarket',
				body: r.pick([
					'Watching the overnight high for an opening range break. Size down into CPI tomorrow.',
					'Index futures flat. Focus on leaders pulling back to the 20-day. No trades before 10:00.',
					'IV elevated across tech — look for premium-selling setups 30–45 DTE.',
					'Gap down on macro headlines. Let the first 30 minutes settle before acting.'
				]),
				createdAt: new Date(nyInstant(day, 8, 30)).toISOString(),
				updatedAt: new Date(nyInstant(day, 8, 30)).toISOString()
			});
		}

		for (let n = 0; n < count; n++) {
			const u = r.pick(UNDERLYINGS);
			const s0 = spot.get(u.symbol) ?? u.price;
			const style = r.pick([
				'zero_dte',
				'zero_dte',
				'long_option',
				'long_option',
				'vertical_debit',
				'credit_spread',
				'credit_spread',
				'iron_condor',
				'short_put',
				'shares',
				'shares',
				'covered_call'
			] as const);
			const isIndex = ['SPY', 'QQQ', 'IWM'].includes(u.symbol);
			const sym = style === 'zero_dte' && !isIndex ? r.pick(['SPY', 'QQQ']) : u.symbol;
			const meta = UNDERLYINGS.find((x) => x.symbol === sym) ?? u;
			const S0 = spot.get(sym) ?? s0;
			const bullish = r.chance(0.58);
			const edge = 0.12; // slight positive expectancy

			const openHour = style === 'zero_dte' ? r.int(10, 13) : r.int(9, 14);
			const openMinute = openHour === 9 ? r.int(35, 59) : r.int(0, 59);
			const openAt = nyInstant(day, openHour, openMinute);

			let holdMinutes: number;
			let expiration: string | null = null;
			let legs: LegSpec[];
			let playbookId: string | null = null;
			const contracts = r.pick([1, 1, 2, 2, 3, 5]);

			switch (style) {
				case 'zero_dte': {
					expiration = day;
					holdMinutes = r.int(6, 110);
					const kind = bullish ? 'call' : 'put';
					legs = [
						{
							kind,
							strike: strikeNear(S0, meta.step, bullish ? 1 : -1),
							expiration,
							qty: contracts * 2
						}
					];
					playbookId = zeroDte.id;
					break;
				}
				case 'long_option': {
					expiration = fridayAfter(day, r.int(5, 30));
					holdMinutes = r.int(60, 60 * 24 * 6);
					const kind = bullish ? 'call' : 'put';
					legs = [
						{
							kind,
							strike: strikeNear(S0, meta.step, bullish ? r.int(0, 2) : -r.int(0, 2)),
							expiration,
							qty: contracts
						}
					];
					playbookId = r.chance(0.5) ? swing.id : orb.id;
					break;
				}
				case 'vertical_debit': {
					expiration = fridayAfter(day, r.int(10, 40));
					holdMinutes = r.int(60 * 6, 60 * 24 * 12);
					const kind = bullish ? 'call' : 'put';
					const k1 = strikeNear(S0, meta.step, 0);
					const width = meta.step * r.pick([2, 4, 5]);
					legs = bullish
						? [
								{ kind, strike: k1, expiration, qty: contracts },
								{ kind, strike: round(k1 + width, 2), expiration, qty: -contracts }
							]
						: [
								{ kind, strike: round(k1 - width, 2), expiration, qty: -contracts },
								{ kind, strike: k1, expiration, qty: contracts }
							];
					playbookId = swing.id;
					break;
				}
				case 'credit_spread': {
					expiration = fridayAfter(day, r.int(28, 45));
					holdMinutes = r.int(60 * 24 * 3, 60 * 24 * 20);
					const width = meta.step * r.pick([2, 4, 5]);
					const otm = S0 * (0.03 + r.next() * 0.04);
					if (bullish) {
						const short = strikeNear(S0 - otm, meta.step);
						legs = [
							{ kind: 'put', strike: round(short - width, 2), expiration, qty: contracts },
							{ kind: 'put', strike: short, expiration, qty: -contracts }
						];
					} else {
						const short = strikeNear(S0 + otm, meta.step);
						legs = [
							{ kind: 'call', strike: short, expiration, qty: -contracts },
							{ kind: 'call', strike: round(short + width, 2), expiration, qty: contracts }
						];
					}
					playbookId = harvest.id;
					break;
				}
				case 'iron_condor': {
					expiration = fridayAfter(day, r.int(30, 45));
					holdMinutes = r.int(60 * 24 * 5, 60 * 24 * 25);
					const width = meta.step * r.pick([2, 4]);
					const otm = S0 * (0.04 + r.next() * 0.03);
					const sp = strikeNear(S0 - otm, meta.step);
					const sc = strikeNear(S0 + otm, meta.step);
					legs = [
						{ kind: 'put', strike: round(sp - width, 2), expiration, qty: contracts },
						{ kind: 'put', strike: sp, expiration, qty: -contracts },
						{ kind: 'call', strike: sc, expiration, qty: -contracts },
						{ kind: 'call', strike: round(sc + width, 2), expiration, qty: contracts }
					];
					playbookId = harvest.id;
					break;
				}
				case 'short_put': {
					expiration = fridayAfter(day, r.int(25, 45));
					holdMinutes = r.int(60 * 24 * 4, 60 * 24 * 25);
					legs = [
						{
							kind: 'put',
							strike: strikeNear(S0 * 0.94, meta.step),
							expiration,
							qty: -Math.min(2, contracts)
						}
					];
					playbookId = harvest.id;
					break;
				}
				case 'covered_call': {
					expiration = fridayAfter(day, r.int(14, 35));
					holdMinutes = r.int(60 * 24 * 5, 60 * 24 * 20);
					legs = [
						{ kind: 'stock', strike: null, expiration: null, qty: 100 },
						{ kind: 'call', strike: strikeNear(S0 * 1.04, meta.step), expiration, qty: -1 }
					];
					break;
				}
				default: {
					holdMinutes = r.chance(0.5) ? r.int(8, 240) : r.int(60 * 24, 60 * 24 * 10);
					legs = [
						{
							kind: 'stock',
							strike: null,
							expiration: null,
							qty: (bullish ? 1 : -1) * r.pick([50, 100, 150, 200, 300])
						}
					];
					playbookId = holdMinutes < 300 ? orb.id : swing.id;
				}
			}

			// Exit before expiry close for options.
			let closeAt = openAt + holdMinutes * 60_000;
			if (expiration) closeAt = Math.min(closeAt, expiryInstant(expiration) - 20 * 60_000);
			closeAt = Math.max(closeAt, openAt + 3 * 60_000);
			// Keep closes inside market hours.
			const closeDay = new Date(closeAt).toISOString().slice(0, 10);
			const closeNy = new Intl.DateTimeFormat('en-US', {
				timeZone: NY,
				hourCycle: 'h23',
				hour: '2-digit'
			}).format(new Date(closeAt));
			if (Number(closeNy) >= 16 || Number(closeNy) < 9)
				closeAt = nyInstant(closeDay, 15, r.int(10, 50));
			if (closeAt <= openAt) closeAt = openAt + 10 * 60_000;
			const wd = new Date(closeAt).getUTCDay();
			if (wd === 6) closeAt -= 86_400_000;
			if (wd === 0) closeAt -= 2 * 86_400_000;
			if (closeAt <= openAt) closeAt = openAt + 15 * 60_000;

			const years = (closeAt - openAt) / (365 * 86_400_000);
			const dirSign = bullish ? 1 : -1;
			const premiumSeller =
				style === 'credit_spread' || style === 'iron_condor' || style === 'short_put';
			const move = premiumSeller
				? meta.iv * Math.sqrt(years) * r.normal() * 0.8
				: dirSign * edge * meta.iv * Math.sqrt(Math.max(years, 1 / 2000)) * 6 +
					meta.iv * Math.sqrt(years) * r.normal();
			const S1 = S0 * Math.exp(move);
			const ivOpen = meta.iv * (premiumSeller ? 1.15 : 1) * (0.9 + r.next() * 0.25);
			const ivClose = ivOpen * (premiumSeller ? 0.85 + r.next() * 0.2 : 0.92 + r.next() * 0.18);

			const legRecords: Leg[] = legs.map((l) => ({
				id: newId(openAt),
				kind: l.kind,
				underlying: sym,
				strike: l.strike,
				expiration: l.expiration,
				multiplier: l.kind === 'stock' ? 1 : 100
			}));

			const execs: Execution[] = [];
			const fee = (spec: LegSpec, qty: number): number =>
				spec.kind === 'stock'
					? round(Math.max(0, qty * 0.005), 2)
					: round(qty * 0.65 + 0.04 * qty, 2);

			const addAt = openAt + Math.floor((closeAt - openAt) * 0.25);
			const partialAt = openAt + Math.floor((closeAt - openAt) * 0.7);
			const scaleIn =
				(style === 'shares' || style === 'long_option') &&
				Math.abs(legs[0]?.qty ?? 0) >= 2 &&
				r.chance(0.35);
			const scaleOut =
				(style === 'shares' || style === 'long_option' || style === 'zero_dte') &&
				Math.abs(legs[0]?.qty ?? 0) >= 2 &&
				r.chance(0.5);
			const sAdd = S0 + (S1 - S0) * 0.2 + S0 * 0.002 * r.normal();
			const sPartial = S0 + (S1 - S0) * 0.75 + S0 * 0.002 * r.normal();

			legs.forEach((spec, i) => {
				const leg = legRecords[i];
				if (!leg) return;
				const total = Math.abs(spec.qty);
				const openSide = spec.qty > 0 ? 'buy' : 'sell';
				const closeSide = spec.qty > 0 ? 'sell' : 'buy';
				const firstQty = scaleIn && i === 0 ? Math.ceil(total / 2) : total;
				const exec = (
					side: 'buy' | 'sell',
					qty: number,
					at: number,
					s: number,
					iv: number,
					kind: Execution['kind'] = 'fill'
				): Execution => ({
					id: newId(at),
					legId: leg.id,
					side,
					kind,
					quantity: qty,
					price: kind === 'expiration' ? 0 : premium(spec, s, at, iv),
					fees: kind === 'expiration' ? 0 : fee(spec, qty),
					executedAt: new Date(at).toISOString(),
					underlyingPrice: round(s, 2),
					note: ''
				});
				execs.push(exec(openSide, firstQty, openAt, S0, ivOpen));
				if (firstQty < total) execs.push(exec(openSide, total - firstQty, addAt, sAdd, ivOpen));
				if (scaleOut && i === 0 && total >= 2) {
					const part = Math.floor(total / 2);
					execs.push(exec(closeSide, part, partialAt, sPartial, (ivOpen + ivClose) / 2));
					execs.push(exec(closeSide, total - part, closeAt, S1, ivClose));
				} else {
					execs.push(exec(closeSide, total, closeAt, S1, ivClose));
				}
			});

			// Some credit trades are held to expiry and expire worthless.
			if (premiumSeller && expiration && r.chance(0.18)) {
				const expAt = expiryInstant(expiration);
				const otmAtExpiry = legs.every((l) => {
					if (l.kind === 'stock') return true;
					return l.kind === 'call' ? S1 < (l.strike ?? 0) : S1 > (l.strike ?? 0);
				});
				if (otmAtExpiry && expAt < Date.parse(`${endDay}T23:59:59Z`)) {
					for (let i = execs.length - 1; i >= 0; i--) {
						const e = execs[i];
						if (e && Date.parse(e.executedAt) === closeAt) execs.splice(i, 1);
					}
					legs.forEach((spec, i) => {
						const leg = legRecords[i];
						if (!leg) return;
						execs.push({
							id: newId(expAt),
							legId: leg.id,
							side: spec.qty > 0 ? 'sell' : 'buy',
							kind: 'expiration',
							quantity: Math.abs(spec.qty),
							price: 0,
							fees: 0,
							executedAt: new Date(expAt).toISOString(),
							underlyingPrice: round(S1, 2),
							note: 'Expired worthless'
						});
					});
				}
			}

			// Leave the most recent few trades open.
			const isRecent = dayIndex >= days.length - 2 && n === 0;
			const finalExecs = isRecent
				? execs.filter(
						(e) => Date.parse(e.executedAt) <= openAt + 60_000 || Date.parse(e.executedAt) === addAt
					)
				: execs;
			const lastFill = Math.max(...finalExecs.map((e) => Date.parse(e.executedAt)));
			if (!isRecent && lastFill > Date.parse(`${endDay}T23:59:59Z`)) continue;

			const levels: PriceLevel[] = [];
			if (style === 'shares' || style === 'long_option' || style === 'zero_dte') {
				const riskPct = style === 'shares' ? 0.012 + r.next() * 0.01 : 0.004 + r.next() * 0.004;
				const stop = round(S0 * (1 - dirSign * riskPct), 2);
				levels.push({
					id: newId(openAt),
					kind: 'stop',
					price: stop,
					setAt: new Date(openAt).toISOString(),
					note: 'Initial stop'
				});
				levels.push({
					id: newId(openAt + 1),
					kind: 'target',
					price: round(S0 * (1 + dirSign * riskPct * r.pick([1.5, 2, 2.5, 3])), 2),
					setAt: new Date(openAt).toISOString(),
					note: 'Initial target'
				});
				if (r.chance(0.4) && closeAt - openAt > 10 * 60_000) {
					const moveAt = openAt + Math.floor((closeAt - openAt) * 0.5);
					levels.push({
						id: newId(moveAt),
						kind: 'stop',
						price: round(S0 * (1 + dirSign * 0.0005), 2),
						setAt: new Date(moveAt).toISOString(),
						note: 'Moved to breakeven'
					});
				}
			}

			const tradeTags: string[] = [];
			const won = (() => {
				// Rough sign for tagging only; the engine computes the real P&L.
				if (premiumSeller) return Math.abs(S1 / S0 - 1) < 0.05;
				return (S1 - S0) * dirSign > 0;
			})();
			if (style === 'zero_dte' || style === 'shares')
				tradeTags.push(r.pick(['Opening range', 'VWAP reclaim']));
			if (won && r.chance(0.5)) tradeTags.push('A+ setup');
			if (!won && r.chance(0.45))
				tradeTags.push(r.pick(['FOMO entry', 'Moved stop', 'Oversized', 'Early exit']));
			if (!won && r.chance(0.15)) tradeTags.push('Revenge');
			if (won && r.chance(0.3)) tradeTags.push('Calm');
			if (r.chance(0.12)) tradeTags.push('Earnings');
			if (r.chance(0.1)) tradeTags.push('FOMC / CPI');
			if (r.chance(0.15)) tradeTags.push('Trend day');

			const assetClass = legs.some((l) => l.kind !== 'stock') ? 'option' : 'stock';
			const created = new Date(openAt).toISOString();
			trades.push({
				id: newId(openAt),
				accountId: style === 'covered_call' || style === 'short_put' ? ira.id : main.id,
				underlying: sym,
				assetClass,
				strategy: null,
				playbookId,
				tagIds: [...new Set(tradeTags)]
					.map((t) => tagByName.get(t))
					.filter((id): id is string => id !== undefined),
				legs: legRecords,
				executions: finalExecs.sort((a, b) => Date.parse(a.executedAt) - Date.parse(b.executedAt)),
				levels,
				plannedRisk: style === 'zero_dte' && r.chance(0.5) ? round(150 + r.next() * 200, 0) : null,
				thesis: r.pick([
					`${sym} holding above VWAP with relative strength versus the index.`,
					`Break of the opening range on ${sym} with expanding volume.`,
					`IV elevated on ${sym}; selling premium outside the expected move.`,
					`Pullback to the 20-day on ${sym} in an uptrend.`,
					`${sym} rejected at resistance; fading the move back to the mean.`
				]),
				review: won
					? r.pick([
							'Followed the plan. Managed the exit well.',
							'Clean execution; could have held the runner longer.',
							''
						])
					: r.pick([
							'Entered before confirmation.',
							'Stop was too tight for the volatility.',
							'Ignored the market context.',
							''
						]),
				rating: r.int(won ? 3 : 1, won ? 5 : 4),
				confidence: r.int(2, 5),
				mfe: null,
				mae: null,
				createdAt: created,
				updatedAt: created
			});
		}

		if (count > 0 && r.chance(0.3)) {
			notes.push({
				id: newId(nyInstant(day, 16, 30)),
				date: day,
				title: 'Session recap',
				kind: 'recap',
				body: r.pick([
					'Stuck to the plan. Best trade came from waiting for the retest.',
					'Overtraded the chop after lunch. Stop trading after two losses.',
					'Good discipline on size. Took profits into strength.',
					'Missed the trend day by fighting the open. Respect the opening drive.'
				]),
				createdAt: new Date(nyInstant(day, 16, 30)).toISOString(),
				updatedAt: new Date(nyInstant(day, 16, 30)).toISOString()
			});
		}
	});

	const now = options.now ?? Date.now();
	const past = (iso: string): boolean => Date.parse(iso) <= now;
	const settled = trades.flatMap((t) => {
		if (t.executions.every((e) => past(e.executedAt))) return [t];
		const executions = t.executions.filter((e) => past(e.executedAt));
		if (!executions.some((e) => e.kind === 'fill')) return [];
		// Keep only legs that were opened before `now`, with the levels set by then.
		const legIds = new Set(executions.map((e) => e.legId));
		return [
			{
				...t,
				legs: t.legs.filter((l) => legIds.has(l.id)),
				executions,
				levels: t.levels.filter((l) => past(l.setAt))
			}
		];
	});
	const pastNotes = notes.filter((n) => past(n.createdAt));

	const settings: UserSettings = { ...DEFAULT_SETTINGS, displayName: 'Sample Trader' };
	return {
		format: 'journalix.journal',
		version: 1,
		exportedAt: new Date(Math.min(now, nyInstant(endDay, 17, 0))).toISOString(),
		settings,
		accounts: [main, ira],
		tags,
		playbooks,
		notes: pastNotes,
		trades: settled
	};
}
