<script lang="ts">
	import { TradeEditorScreen } from '@strikebook/ui';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head><title>Edit trade — Strikebook</title></svelte:head>
{#key params.id}
	<TradeEditorScreen tradeId={params.id} />
{/key}
