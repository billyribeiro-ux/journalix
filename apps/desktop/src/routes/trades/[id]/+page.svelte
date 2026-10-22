<script lang="ts">
	import { TradeDetailScreen } from '@journalix/ui';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head><title>Trade — Journalix</title></svelte:head>

{#key params.id}
	<TradeDetailScreen tradeId={params.id} />
{/key}
