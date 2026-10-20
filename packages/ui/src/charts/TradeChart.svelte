<script lang="ts">
	import type { TradeView } from '@strikebook/core';
	import type { Bar, Timeframe } from '@strikebook/core/market-data';

	interface Props {
		view: TradeView;
		/** Underlying (or contract) bars; `null` draws the fills on a price line only. */
		bars: readonly Bar[] | null;
		timeframe: Timeframe;
		timeZone: string;
		/** Bars came from the simulator — the chart shows a "Simulated prices" label. */
		simulated?: boolean;
		height?: number;
		/** `underlying` plots stock/underlying fills; `contract` plots option premiums. */
		mode?: 'underlying' | 'contract';
	}

	let { view, bars, timeframe, timeZone, simulated = false, height = 420, mode = 'underlying' }: Props = $props();
</script>

<div style:height="{height}px" data-trade={view.trade.id} data-bars={bars?.length ?? 0} data-tf={timeframe} data-tz={timeZone} data-sim={simulated} data-mode={mode}></div>
