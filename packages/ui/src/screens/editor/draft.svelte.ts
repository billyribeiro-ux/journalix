/**
 * Editable draft of a trade. Inputs hold partial values (empty numbers are `null`, times are
 * `<datetime-local>` strings in the user's zone); `build()` turns the draft into a validated
 * `Trade` or a list of issues keyed by field.
 */
import * as v from 'valibot';
import {
	computeTradeMetrics,
	fromLocalInput,
	newId,
	toLocalInput,
	TradeSchema,
	type AssetClass,
	type ExecutionKind,
	type LegKind,
	type Side,
	type StrategyKind,
	type Trade,
	type TradeMetrics,
	type UserSettings
} from '@journalix/core';

export interface DraftLeg {
	id: string;
	kind: LegKind;
	strike: number | null;
	expiration: string;
	multiplier: number | null;
}

export interface DraftExecution {
	id: string;
	legId: string;
	side: Side;
	kind: ExecutionKind;
	quantity: number | null;
	price: number | null;
	fees: number | null;
	executedAt: string;
	underlyingPrice: number | null;
	note: string;
}

export interface DraftLevel {
	id: string;
	kind: 'stop' | 'target';
	price: number | null;
	setAt: string;
	note: string;
}

export type StructurePreset =
	| 'single'
	| 'vertical'
	| 'straddle'
	| 'strangle'
	| 'iron_condor'
	| 'butterfly'
	| 'calendar'
	| 'covered_call';

export const STRUCTURE_PRESETS: readonly { value: StructurePreset; label: string }[] = [
	{ value: 'single', label: 'Single option' },
	{ value: 'vertical', label: 'Vertical spread' },
	{ value: 'straddle', label: 'Straddle' },
	{ value: 'strangle', label: 'Strangle' },
	{ value: 'iron_condor', label: 'Iron condor' },
	{ value: 'butterfly', label: 'Butterfly' },
	{ value: 'calendar', label: 'Calendar' },
	{ value: 'covered_call', label: 'Covered call' }
];

const isOption = (kind: LegKind): boolean => kind === 'call' || kind === 'put';

export function defaultMultiplier(kind: LegKind): number {
	return isOption(kind) ? 100 : kind === 'future' ? 50 : 1;
}

export class TradeDraft {
	readonly id: string;
	readonly createdAt: string;
	readonly #settings: UserSettings;

	accountId = $state('');
	assetClass = $state<AssetClass>('option');
	underlying = $state('');
	strategy = $state<StrategyKind | ''>('');
	playbookId = $state('');
	tagIds = $state<string[]>([]);
	plannedRisk = $state<number | null>(null);
	thesis = $state('');
	review = $state('');
	rating = $state<number | null>(null);
	confidence = $state<number | null>(null);
	mfe = $state<number | null>(null);
	mae = $state<number | null>(null);
	legs = $state<DraftLeg[]>([]);
	executions = $state<DraftExecution[]>([]);
	levels = $state<DraftLevel[]>([]);

	constructor(
		settings: UserSettings,
		source: Trade | null,
		options: { duplicate?: boolean; accountId?: string } = {}
	) {
		this.#settings = settings;
		const duplicate = options.duplicate === true;
		this.id = source && !duplicate ? source.id : newId();
		this.createdAt = source && !duplicate ? source.createdAt : new Date().toISOString();
		if (!source) {
			this.accountId = options.accountId ?? '';
			this.legs = [this.newLeg('call')];
			return;
		}
		const tz = settings.timeZone;
		// Duplicates get fresh ids so they never collide with the original.
		const legIds = new Map(source.legs.map((l) => [l.id, duplicate ? newId() : l.id]));
		this.accountId = source.accountId;
		this.assetClass = source.assetClass;
		this.underlying = source.underlying;
		this.strategy = source.strategy ?? '';
		this.playbookId = source.playbookId ?? '';
		this.tagIds = [...source.tagIds];
		this.plannedRisk = source.plannedRisk;
		this.thesis = source.thesis;
		this.review = duplicate ? '' : source.review;
		this.rating = duplicate ? null : source.rating;
		this.confidence = source.confidence;
		this.mfe = duplicate ? null : source.mfe;
		this.mae = duplicate ? null : source.mae;
		this.legs = source.legs.map((l) => ({
			id: legIds.get(l.id) ?? newId(),
			kind: l.kind,
			strike: l.strike,
			expiration: l.expiration ?? '',
			multiplier: l.multiplier
		}));
		this.executions = duplicate
			? []
			: source.executions.map((e) => ({
					id: e.id,
					legId: legIds.get(e.legId) ?? e.legId,
					side: e.side,
					kind: e.kind,
					quantity: e.quantity,
					price: e.price,
					fees: e.fees,
					executedAt: toLocalInput(e.executedAt, tz),
					underlyingPrice: e.underlyingPrice,
					note: e.note
				}));
		this.levels = duplicate
			? []
			: source.levels.map((l) => ({
					id: l.id,
					kind: l.kind,
					price: l.price,
					setAt: toLocalInput(l.setAt, tz),
					note: l.note
				}));
	}

	get timeZone(): string {
		return this.#settings.timeZone;
	}

	nowLocal(): string {
		return toLocalInput(Date.now(), this.#settings.timeZone);
	}

	newLeg(kind: LegKind, strike: number | null = null, expiration = ''): DraftLeg {
		return {
			id: newId(),
			kind,
			strike: isOption(kind) ? strike : null,
			expiration: isOption(kind) ? expiration : '',
			multiplier: defaultMultiplier(kind)
		};
	}

	setAssetClass(next: AssetClass): void {
		this.assetClass = next;
		const kind: LegKind =
			next === 'option'
				? 'call'
				: next === 'future'
					? 'future'
					: next === 'crypto'
						? 'crypto'
						: next === 'forex'
							? 'forex'
							: 'stock';
		if (next !== 'option') {
			const first = this.legs[0];
			this.legs = [
				{
					...(first ?? this.newLeg(kind)),
					kind,
					strike: null,
					expiration: '',
					multiplier: defaultMultiplier(kind)
				}
			];
			const keep = this.legs[0]?.id;
			this.executions = this.executions.map((e) => ({ ...e, legId: keep ?? e.legId }));
		} else if (this.legs.every((l) => !isOption(l.kind))) {
			this.legs = [this.newLeg('call')];
		}
	}

	addLeg(kind: LegKind = 'call'): void {
		const last = this.legs[this.legs.length - 1];
		this.legs = [...this.legs, this.newLeg(kind, last?.strike ?? null, last?.expiration ?? '')];
	}

	removeLeg(id: string): void {
		if (this.legs.length <= 1) return;
		this.legs = this.legs.filter((l) => l.id !== id);
		this.executions = this.executions.filter((e) => e.legId !== id);
	}

	/** Replaces the legs with a named structure around a centre strike, keeping no fills. */
	applyPreset(
		preset: StructurePreset,
		centre: number | null,
		expiration: string,
		width: number
	): void {
		const k = centre ?? null;
		const at = (offset: number): number | null =>
			k === null ? null : Math.round((k + offset * width) * 100) / 100;
		const leg = (kind: LegKind, strike: number | null, exp = expiration): DraftLeg =>
			this.newLeg(kind, strike, exp);
		let legs: DraftLeg[];
		switch (preset) {
			case 'single':
				legs = [leg('call', at(0))];
				break;
			case 'vertical':
				legs = [leg('call', at(0)), leg('call', at(1))];
				break;
			case 'straddle':
				legs = [leg('call', at(0)), leg('put', at(0))];
				break;
			case 'strangle':
				legs = [leg('put', at(-1)), leg('call', at(1))];
				break;
			case 'iron_condor':
				legs = [leg('put', at(-2)), leg('put', at(-1)), leg('call', at(1)), leg('call', at(2))];
				break;
			case 'butterfly':
				legs = [leg('call', at(-1)), leg('call', at(0)), leg('call', at(1))];
				break;
			case 'calendar':
				legs = [leg('call', at(0)), leg('call', at(0), '')];
				break;
			case 'covered_call':
				legs = [leg('stock', null), leg('call', at(1))];
				break;
		}
		this.legs = legs;
		this.executions = [];
	}

	feesFor(legId: string, quantity: number | null): number {
		const leg = this.legs.find((l) => l.id === legId);
		if (!leg || quantity === null) return 0;
		const rate = isOption(leg.kind)
			? this.#settings.defaultCommissionPerContract
			: this.#settings.defaultCommissionPerShare;
		return Math.round(rate * quantity * 100) / 100;
	}

	addExecution(partial: Partial<DraftExecution> = {}): DraftExecution {
		const legId = partial.legId ?? this.legs[0]?.id ?? '';
		const previous = [...this.executions].reverse().find((e) => e.legId === legId);
		const quantity = partial.quantity ?? previous?.quantity ?? null;
		const execution: DraftExecution = {
			id: newId(),
			legId,
			side: partial.side ?? previous?.side ?? 'buy',
			kind: partial.kind ?? 'fill',
			quantity,
			price: partial.price ?? null,
			fees: partial.fees ?? this.feesFor(legId, quantity),
			executedAt: partial.executedAt ?? this.nowLocal(),
			underlyingPrice: partial.underlyingPrice ?? previous?.underlyingPrice ?? null,
			note: partial.note ?? ''
		};
		this.executions = [...this.executions, execution];
		return execution;
	}

	removeExecution(id: string): void {
		this.executions = this.executions.filter((e) => e.id !== id);
	}

	/**
	 * Adds one fill per leg at the same moment (how a spread is filled), with sides taken from the
	 * opening structure: `open` repeats the opening side, `close` reverses it.
	 */
	addSpreadFill(action: 'open' | 'close', quantity: number | null): void {
		const at = this.nowLocal();
		const openingSide = new Map<string, Side>();
		for (const e of [...this.executions].sort((a, b) => a.executedAt.localeCompare(b.executedAt))) {
			if (!openingSide.has(e.legId)) openingSide.set(e.legId, e.side);
		}
		for (const leg of this.legs) {
			const opening = openingSide.get(leg.id) ?? 'buy';
			const side: Side = action === 'open' ? opening : opening === 'buy' ? 'sell' : 'buy';
			const qty = quantity ?? null;
			this.addExecution({
				legId: leg.id,
				side,
				quantity: qty,
				executedAt: at,
				fees: this.feesFor(leg.id, qty)
			});
		}
	}

	/** Closes whatever is still open on every leg with fills (or expirations) at one moment. */
	closeRemaining(metrics: TradeMetrics | null, kind: ExecutionKind = 'fill'): void {
		if (!metrics) return;
		const at = this.nowLocal();
		for (const state of metrics.legs) {
			if (state.netQuantity === 0) continue;
			const qty = Math.abs(state.netQuantity);
			this.addExecution({
				legId: state.leg.id,
				side: state.netQuantity > 0 ? 'sell' : 'buy',
				kind,
				quantity: qty,
				price: kind === 'expiration' ? 0 : null,
				fees: kind === 'expiration' ? 0 : this.feesFor(state.leg.id, qty),
				executedAt: at
			});
		}
	}

	addLevel(kind: 'stop' | 'target'): void {
		const last = [...this.levels].reverse().find((l) => l.kind === kind);
		const firstFill = [...this.executions].sort((a, b) =>
			a.executedAt.localeCompare(b.executedAt)
		)[0];
		this.levels = [
			...this.levels,
			{
				id: newId(),
				kind,
				price: last?.price ?? null,
				setAt: last ? this.nowLocal() : (firstFill?.executedAt ?? this.nowLocal()),
				note: last ? `Moved ${kind}` : `Initial ${kind}`
			}
		];
	}

	removeLevel(id: string): void {
		this.levels = this.levels.filter((l) => l.id !== id);
	}

	#local(value: string): string | null {
		try {
			return value ? fromLocalInput(value, this.#settings.timeZone) : null;
		} catch {
			return null;
		}
	}

	/** The draft as a candidate trade (unvalidated). Incomplete rows are kept for validation. */
	candidate(includeIncomplete: boolean): unknown {
		const symbol = this.underlying.trim().toUpperCase();
		const now = new Date().toISOString();
		const executions = this.executions
			.filter(
				(e) =>
					includeIncomplete ||
					(e.quantity !== null && e.price !== null && this.#local(e.executedAt) !== null)
			)
			.map((e) => ({
				id: e.id,
				legId: e.legId,
				side: e.side,
				kind: e.kind,
				quantity: e.quantity,
				price: e.price,
				fees: e.fees ?? 0,
				executedAt: this.#local(e.executedAt),
				underlyingPrice: e.underlyingPrice,
				note: e.note
			}));
		return {
			id: this.id,
			accountId: this.accountId,
			underlying: symbol,
			assetClass: this.assetClass,
			strategy: this.strategy === '' ? null : this.strategy,
			playbookId: this.playbookId === '' ? null : this.playbookId,
			tagIds: [...this.tagIds],
			legs: this.legs.map((l) => ({
				id: l.id,
				kind: l.kind,
				underlying: symbol,
				strike: isOption(l.kind) ? l.strike : null,
				expiration: isOption(l.kind) ? l.expiration || null : null,
				multiplier: l.multiplier
			})),
			executions,
			levels: this.levels
				.filter((l) => includeIncomplete || (l.price !== null && this.#local(l.setAt) !== null))
				.map((l) => ({
					id: l.id,
					kind: l.kind,
					price: l.price,
					setAt: this.#local(l.setAt),
					note: l.note
				})),
			plannedRisk: this.plannedRisk,
			thesis: this.thesis,
			review: this.review,
			rating: this.rating,
			confidence: this.confidence,
			mfe: this.mfe,
			mae: this.mae,
			createdAt: this.createdAt,
			updatedAt: now
		};
	}

	/** Live metrics from the complete parts of the draft, for the summary panel. */
	preview(): TradeMetrics | null {
		const result = v.safeParse(TradeSchema, this.candidate(false));
		if (!result.success) return null;
		return computeTradeMetrics(result.output, {
			timeZone: this.#settings.timeZone,
			breakevenThreshold: this.#settings.breakevenThreshold
		});
	}

	build(): { ok: true; trade: Trade } | { ok: false; issues: Map<string, string> } {
		const result = v.safeParse(TradeSchema, this.candidate(true));
		if (result.success) return { ok: true, trade: result.output };
		const issues = new Map<string, string>();
		for (const issue of result.issues) {
			const path = issue.path?.map((p) => String(p.key)) ?? [];
			let key = path.join('.') || 'trade';
			// Map array indices back to row ids so errors sit next to the right row.
			if (path[0] === 'legs' && path[1] !== undefined)
				key = `leg:${this.legs[Number(path[1])]?.id}:${path[2] ?? ''}`;
			if (path[0] === 'executions' && path[1] !== undefined)
				key = `exec:${this.executions[Number(path[1])]?.id}:${path[2] ?? ''}`;
			if (path[0] === 'levels' && path[1] !== undefined)
				key = `level:${this.levels[Number(path[1])]?.id}:${path[2] ?? ''}`;
			const message = issue.message.startsWith('Invalid type') ? 'Required' : issue.message;
			if (!issues.has(key)) issues.set(key, message);
		}
		return { ok: false, issues };
	}
}
