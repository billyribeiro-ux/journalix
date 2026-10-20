<script lang="ts">
	import { formatMoney } from '@journalix/core';

	interface Props {
		value: number | null;
		currency?: string;
		compact?: boolean;
		/** Values within ±threshold read as neutral. */
		threshold?: number;
	}

	let { value, currency = 'USD', compact = false, threshold = 0.005 }: Props = $props();
	const tone = $derived(
		value === null ? 'none' : value > threshold ? 'gain' : value < -threshold ? 'loss' : 'flat'
	);
</script>

<span class="pnl num {tone}">{formatMoney(value, { currency, signed: true, compact })}</span>

<style>
	.pnl {
		font-weight: 500;
		white-space: nowrap;
	}

	.gain {
		color: var(--color-gain);
	}

	.loss {
		color: var(--color-loss);
	}

	.flat,
	.none {
		color: var(--color-ink-2);
	}
</style>
