<script lang="ts">
	import { page } from '$app/state';
	import { TradeEditorScreen } from '@strikebook/ui';

	const duplicateOf = $derived(page.url.searchParams.get('duplicate') ?? undefined);
</script>

{#key duplicateOf}
	<TradeEditorScreen {duplicateOf} />
{/key}
