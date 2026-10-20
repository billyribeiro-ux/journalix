<script lang="ts">
	import { TradeDetailScreen } from '@strikebook/ui';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head><title>Trade — Strikebook</title></svelte:head>
{#key params.id}
	<TradeDetailScreen tradeId={params.id} />
{/key}
