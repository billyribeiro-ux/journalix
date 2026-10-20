import type { AssetClass, StrategyKind } from '../domain/schemas.ts';
import type { TradeOutcome, TradeStatus, TradeView } from '../engine/position.ts';
import { dayKey } from '../util/time.ts';

/** Global filter applied before every report. Empty arrays mean "no restriction". */
export interface TradeFilter {
	readonly from: string | null;
	readonly to: string | null;
	readonly accountIds: readonly string[];
	readonly symbols: readonly string[];
	readonly strategies: readonly StrategyKind[];
	readonly tagIds: readonly string[];
	readonly playbookIds: readonly string[];
	readonly statuses: readonly TradeStatus[];
	readonly outcomes: readonly TradeOutcome[];
	readonly directions: readonly ('long' | 'short')[];
	readonly assetClasses: readonly AssetClass[];
	readonly search: string;
}

export const EMPTY_FILTER: TradeFilter = {
	from: null,
	to: null,
	accountIds: [],
	symbols: [],
	strategies: [],
	tagIds: [],
	playbookIds: [],
	statuses: [],
	outcomes: [],
	directions: [],
	assetClasses: [],
	search: ''
};

export function isFilterActive(filter: TradeFilter): boolean {
	return (
		filter.from !== null ||
		filter.to !== null ||
		filter.search.trim() !== '' ||
		[
			filter.accountIds,
			filter.symbols,
			filter.strategies,
			filter.tagIds,
			filter.playbookIds,
			filter.statuses,
			filter.outcomes,
			filter.directions,
			filter.assetClasses
		].some((a) => a.length > 0)
	);
}

export function applyFilter(views: readonly TradeView[], filter: TradeFilter, timeZone: string): TradeView[] {
	const needle = filter.search.trim().toUpperCase();
	return views.filter(({ trade, metrics }) => {
		const anchor = metrics.closedAt ?? metrics.openedAt ?? trade.createdAt;
		const day = dayKey(anchor, timeZone);
		if (filter.from !== null && day < filter.from) return false;
		if (filter.to !== null && day > filter.to) return false;
		if (filter.accountIds.length && !filter.accountIds.includes(trade.accountId)) return false;
		if (filter.symbols.length && !filter.symbols.includes(trade.underlying)) return false;
		if (filter.strategies.length && !filter.strategies.includes(metrics.strategy)) return false;
		if (filter.tagIds.length && !filter.tagIds.some((t) => trade.tagIds.includes(t))) return false;
		if (filter.playbookIds.length && (trade.playbookId === null || !filter.playbookIds.includes(trade.playbookId))) return false;
		if (filter.statuses.length && !filter.statuses.includes(metrics.status)) return false;
		if (filter.outcomes.length && !filter.outcomes.includes(metrics.outcome)) return false;
		if (filter.directions.length && !filter.directions.includes(metrics.direction)) return false;
		if (filter.assetClasses.length && !filter.assetClasses.includes(trade.assetClass)) return false;
		if (needle) {
			const haystack = `${trade.underlying} ${trade.thesis} ${trade.review}`.toUpperCase();
			if (!haystack.includes(needle)) return false;
		}
		return true;
	});
}
