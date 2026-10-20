<script lang="ts">
	import { page } from '$app/state';
	import { TradeEditorScreen } from '@journalix/ui';

	const duplicateOf = $derived(page.url.searchParams.get('duplicate') ?? undefined);
</script>

<svelte:head><title>New trade — Journalix</title></svelte:head>
{#key duplicateOf}
	<TradeEditorScreen {duplicateOf} />
{/key}
