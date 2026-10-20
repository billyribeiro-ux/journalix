<script lang="ts">
	import { TradeDetailScreen } from '@journalix/ui';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

{#key params.id}
	<TradeDetailScreen tradeId={params.id} />
{/key}
