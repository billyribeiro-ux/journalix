<script lang="ts">
	import type { TradeOutcome, TradeStatus } from '@strikebook/core';
	import Badge from '../../primitives/Badge.svelte';

	interface Props {
		status: TradeStatus;
		outcome: TradeOutcome;
	}

	let { status, outcome }: Props = $props();
</script>

{#if status === 'planned'}
	<Badge tone="outline">Planned</Badge>
{:else if status === 'open'}
	<Badge tone="signal">Open</Badge>
{:else if outcome === 'win'}
	<Badge tone="gain">Win</Badge>
{:else if outcome === 'loss'}
	<Badge tone="loss">Loss</Badge>
{:else}
	<Badge>Breakeven</Badge>
{/if}
