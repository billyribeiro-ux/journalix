/**
 * Position engine: turns a trade's raw executions into its full lifecycle —
 * per-leg average cost, realized P&L, status, direction, risk, R-multiple and timing.
 *
 * Cost basis uses the average-cost method per leg, the same convention most broker
 * statements use for intraday position P&L. Fees are tracked separately so gross and net
 * figures are both available.
 */
import type { Execution, Leg, PriceLevel, StrategyKind, Trade } from '../domain/schemas.ts';
import { detectStrategy, STRATEGIES, type StrategyBias, type StructureLeg } from '../options/strategy.ts';
import { payoffProfile, type PayoffLeg } from '../options/payoff.ts';
import { calendarDaysBetween } from '../util/time.ts';
import { clean, sum } from '../util/math.ts';

export type TradeStatus = 'planned' | 'open' | 'closed';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open';
export type RiskSource = 'planned' | 'stop' | 'structure';

export interface LegState {
	readonly leg: Leg;
	/** Signed open size after all executions (+ long, − short). */
	readonly netQuantity: number;
	/** Average price of the currently open size, or of the opening fills once flat. */
	readonly averageOpenPrice: number;
	/** Average price of the fills that reduced the position. */
	readonly averageClosePrice: number | null;
	/** Signed size at the first opening fill's direction, at its largest. */
	readonly peakQuantity: number;
	readonly openedQuantity: number;
	readonly closedQuantity: number;
	readonly realizedPnl: number;
	readonly fees: number;
	/** Premium/cash at open: + received (credit), − paid (debit), multiplier applied. */
	readonly openingCashflow: number;
	readonly executions: readonly Execution[];
}

export interface TradeMetrics {
	readonly status: TradeStatus;
	readonly outcome: TradeOutcome;
	readonly openedAt: string | null;
	readonly closedAt: string | null;
	readonly holdMs: number | null;
	readonly strategy: StrategyKind;
	readonly detectedStrategy: StrategyKind;
	readonly bias: StrategyBias;
	/** Long = bought to open (debit); short = sold to open (credit). */
	readonly direction: 'long' | 'short';
	readonly entryType: 'debit' | 'credit' | 'even';
	readonly legs: readonly LegState[];
	readonly grossPnl: number;
	readonly fees: number;
	readonly netPnl: number;
	/** Net premium at open: + credit, − debit. */
	readonly openingCashflow: number;
	/** Average entry and exit of the primary leg (per share / per contract unit). */
	readonly averageEntry: number | null;
	readonly averageExit: number | null;
	/** Largest open size of the primary leg. */
	readonly quantity: number;
	readonly adds: number;
	readonly partialExits: number;
	readonly initialStop: number | null;
	readonly currentStop: number | null;
	readonly initialTarget: number | null;
	readonly currentTarget: number | null;
	readonly initialRisk: number | null;
	readonly riskSource: RiskSource | null;
	readonly rMultiple: number | null;
	/** Planned reward:risk from the initial target and stop. */
	readonly plannedRewardRisk: number | null;
	readonly maxProfit: number | null;
	readonly maxLoss: number | null;
	readonly breakevens: readonly number[];
	readonly definedRisk: boolean;
	/** Days to the nearest expiry at the first fill (options only). */
	readonly dteAtEntry: number | null;
	readonly nearestExpiration: string | null;
	readonly underlyingAtEntry: number | null;
	readonly underlyingAtExit: number | null;
	readonly expiredWorthless: boolean;
	readonly assigned: boolean;
}

export interface EngineOptions {
	readonly timeZone: string;
	/** Net P&L within ±threshold is treated as breakeven. */
	readonly breakevenThreshold: number;
}

const byTime = (a: Execution, b: Execution): number =>
	Date.parse(a.executedAt) - Date.parse(b.executedAt) || a.id.localeCompare(b.id);

/** Replays one leg's executions with the average-cost method. */
export function computeLegState(leg: Leg, executions: readonly Execution[]): LegState {
	const fills = executions.filter((e) => e.legId === leg.id).sort(byTime);
	let position = 0;
	let average = 0;
	let realized = 0;
	let peak = 0;
	let opened = 0;
	let closed = 0;
	let openingNotional = 0;
	let closingNotional = 0;
	let openingCash = 0;
	let openingDirection = 0;

	for (const fill of fills) {
		const signed = fill.side === 'buy' ? fill.quantity : -fill.quantity;
		if (openingDirection === 0) openingDirection = Math.sign(signed);

		if (position === 0 || Math.sign(signed) === Math.sign(position)) {
			const size = Math.abs(position) + Math.abs(signed);
			average = (average * Math.abs(position) + fill.price * Math.abs(signed)) / size;
			position += signed;
			opened += Math.abs(signed);
			openingNotional += fill.price * Math.abs(signed);
			openingCash += -signed * fill.price * leg.multiplier;
		} else {
			const closing = Math.min(Math.abs(signed), Math.abs(position));
			realized += closing * (fill.price - average) * Math.sign(position) * leg.multiplier;
			closed += closing;
			closingNotional += fill.price * closing;
			position += Math.sign(signed) * closing;
			const remainder = Math.abs(signed) - closing;
			if (remainder > 1e-12) {
				// Position flips through zero: the rest opens a new position at this price.
				position = Math.sign(signed) * remainder;
				average = fill.price;
				opened += remainder;
				openingNotional += fill.price * remainder;
				openingCash += -Math.sign(signed) * remainder * fill.price * leg.multiplier;
			}
			if (Math.abs(position) < 1e-12) position = 0;
		}
		if (openingDirection !== 0 && Math.sign(position) === openingDirection) {
			peak = Math.max(peak, Math.abs(position));
		}
	}

	return {
		leg,
		netQuantity: clean(position),
		averageOpenPrice: position !== 0 ? average : opened > 0 ? openingNotional / opened : 0,
		averageClosePrice: closed > 0 ? closingNotional / closed : null,
		peakQuantity: openingDirection * peak,
		openedQuantity: opened,
		closedQuantity: closed,
		realizedPnl: clean(realized),
		fees: sum(fills.map((f) => f.fees)),
		openingCashflow: clean(openingCash),
		executions: fills
	};
}

function sortLevels(levels: readonly PriceLevel[], kind: PriceLevel['kind']): PriceLevel[] {
	return levels
		.filter((l) => l.kind === kind)
		.sort((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt) || a.id.localeCompare(b.id));
}

function isOptionLeg(leg: Leg): boolean {
	return leg.kind === 'call' || leg.kind === 'put';
}

/** Opening structure used for strategy detection and the expiry payoff. */
export function openingStructure(states: readonly LegState[]): PayoffLeg[] & StructureLeg[] {
	return states
		.filter((s) => s.peakQuantity !== 0)
		.map((s) => ({
			kind: s.leg.kind,
			strike: s.leg.strike,
			expiration: s.leg.expiration,
			quantity: s.peakQuantity,
			multiplier: s.leg.multiplier,
			entryPrice: s.averageOpenPrice
		}));
}

export function computeTradeMetrics(trade: Trade, options: EngineOptions): TradeMetrics {
	const states = trade.legs.map((leg) => computeLegState(leg, trade.executions));
	const fills = [...trade.executions].sort(byTime);
	const first = fills[0];
	const last = fills[fills.length - 1];

	const anyOpen = states.some((s) => s.netQuantity !== 0);
	const status: TradeStatus = fills.length === 0 ? 'planned' : anyOpen ? 'open' : 'closed';

	const grossPnl = clean(sum(states.map((s) => s.realizedPnl)));
	const fees = sum(states.map((s) => s.fees));
	const netPnl = clean(grossPnl - fees);

	const structure = openingStructure(states);
	const detectedStrategy = detectStrategy(structure);
	const strategy = trade.strategy ?? detectedStrategy;
	const info = STRATEGIES[strategy];

	const openingCashflow = clean(sum(states.map((s) => s.openingCashflow)));
	const entryType: TradeMetrics['entryType'] =
		openingCashflow > 1e-9 ? 'credit' : openingCashflow < -1e-9 ? 'debit' : 'even';

	const primary = states.find((s) => s.peakQuantity !== 0) ?? states[0];
	const singleLeg = structure.length === 1;
	const direction: TradeMetrics['direction'] = singleLeg
		? (primary?.peakQuantity ?? 0) >= 0
			? 'long'
			: 'short'
		: entryType === 'credit'
			? 'short'
			: 'long';

	// Adds and partial exits on the primary leg.
	let adds = 0;
	let partialExits = 0;
	if (primary) {
		let pos = 0;
		let openingSeen = false;
		for (const fill of primary.executions) {
			const signed = fill.side === 'buy' ? fill.quantity : -fill.quantity;
			const increases = pos === 0 || Math.sign(signed) === Math.sign(pos);
			if (increases) {
				if (openingSeen) adds++;
				openingSeen = true;
			} else if (Math.abs(signed) < Math.abs(pos) - 1e-12) {
				partialExits++;
			}
			pos += signed;
		}
	}

	const stops = sortLevels(trade.levels, 'stop');
	const targets = sortLevels(trade.levels, 'target');
	const initialStop = stops[0]?.price ?? null;
	const currentStop = stops[stops.length - 1]?.price ?? null;
	const initialTarget = targets[0]?.price ?? null;
	const currentTarget = targets[targets.length - 1]?.price ?? null;

	const hasOptions = trade.legs.some(isOptionLeg);
	const profile = structure.length > 0 && hasOptions ? payoffProfile(structure) : null;
	const maxLoss = profile?.maxLoss ?? null;
	const maxProfit = profile?.maxProfit ?? null;

	// Risk precedence: explicit dollar risk, then stop distance (linear legs), then structure.
	let initialRisk: number | null = null;
	let riskSource: RiskSource | null = null;
	const averageEntry = primary && primary.openedQuantity > 0 ? primary.averageOpenPrice : null;
	if (trade.plannedRisk !== null) {
		initialRisk = trade.plannedRisk;
		riskSource = 'planned';
	} else if (initialStop !== null && singleLeg && primary && !isOptionLeg(primary.leg) && averageEntry !== null) {
		const perUnit = Math.abs(averageEntry - initialStop);
		const risk = perUnit * Math.abs(primary.peakQuantity) * primary.leg.multiplier;
		if (risk > 0) {
			initialRisk = risk;
			riskSource = 'stop';
		}
	} else if (maxLoss !== null && maxLoss < 0) {
		initialRisk = -maxLoss;
		riskSource = 'structure';
	}

	const rMultiple = initialRisk !== null && initialRisk > 0 && status === 'closed' ? netPnl / initialRisk : null;

	let plannedRewardRisk: number | null = null;
	if (initialStop !== null && initialTarget !== null && averageEntry !== null && singleLeg && primary && !isOptionLeg(primary.leg)) {
		const risk = Math.abs(averageEntry - initialStop);
		if (risk > 0) plannedRewardRisk = Math.abs(initialTarget - averageEntry) / risk;
	}

	const expirations = trade.legs
		.filter(isOptionLeg)
		.map((l) => l.expiration)
		.filter((e): e is string => e !== null)
		.sort();
	const nearestExpiration = expirations[0] ?? null;
	const dteAtEntry =
		first && nearestExpiration ? calendarDaysBetween(first.executedAt, nearestExpiration, 'America/New_York') : null;

	const openedAt = first?.executedAt ?? null;
	const closedAt = status === 'closed' ? (last?.executedAt ?? null) : null;
	const holdMs = openedAt && closedAt ? Date.parse(closedAt) - Date.parse(openedAt) : null;

	const outcome: TradeOutcome =
		status !== 'closed'
			? 'open'
			: Math.abs(netPnl) <= options.breakevenThreshold
				? 'breakeven'
				: netPnl > 0
					? 'win'
					: 'loss';

	const underlyingAtEntry = fills.find((f) => f.underlyingPrice !== null)?.underlyingPrice ?? null;
	const underlyingAtExit =
		status === 'closed' ? ([...fills].reverse().find((f) => f.underlyingPrice !== null)?.underlyingPrice ?? null) : null;

	return {
		status,
		outcome,
		openedAt,
		closedAt,
		holdMs,
		strategy,
		detectedStrategy,
		bias: info.bias,
		direction,
		entryType,
		legs: states,
		grossPnl,
		fees,
		netPnl,
		openingCashflow,
		averageEntry,
		averageExit: primary?.averageClosePrice ?? null,
		quantity: Math.abs(primary?.peakQuantity ?? 0),
		adds,
		partialExits,
		initialStop,
		currentStop,
		initialTarget,
		currentTarget,
		initialRisk,
		riskSource,
		rMultiple,
		plannedRewardRisk,
		maxProfit,
		maxLoss,
		breakevens: profile?.breakevens ?? [],
		definedRisk: hasOptions ? maxLoss !== null : false,
		dteAtEntry,
		nearestExpiration,
		underlyingAtEntry,
		underlyingAtExit,
		expiredWorthless: fills.some((f) => f.kind === 'expiration'),
		assigned: fills.some((f) => f.kind === 'assignment' || f.kind === 'exercise')
	};
}

/** A trade paired with its computed metrics — the unit every report works on. */
export interface TradeView {
	readonly trade: Trade;
	readonly metrics: TradeMetrics;
}

export function buildTradeViews(trades: readonly Trade[], options: EngineOptions): TradeView[] {
	return trades.map((trade) => ({ trade, metrics: computeTradeMetrics(trade, options) }));
}
