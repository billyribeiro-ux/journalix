<script lang="ts">
	import { page } from '$app/state';
	import { TradeEditorScreen } from '@strikebook/ui';

	const duplicateOf = $derived(page.url.searchParams.get('duplicate') ?? undefined);
</script>

<svelte:head><title>New trade — Strikebook</title></svelte:head>
{#key duplicateOf}
	<TradeEditorScreen {duplicateOf} />
{/key}
