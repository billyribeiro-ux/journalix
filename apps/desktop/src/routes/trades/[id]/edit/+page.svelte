<script lang="ts">
	import { TradeEditorScreen } from '@strikebook/ui';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

{#key params.id}
	<TradeEditorScreen tradeId={params.id} />
{/key}
