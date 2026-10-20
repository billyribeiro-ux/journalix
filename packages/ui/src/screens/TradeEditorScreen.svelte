<script lang="ts">
	interface Props {
		/** Edit this trade; omit to create a new one. */
		tradeId?: string;
		/** Pre-fill a new trade from an existing one. */
		duplicateOf?: string;
	}
	let { tradeId, duplicateOf }: Props = $props();
</script>

<p>TradeEditorScreen {tradeId ?? ''} {duplicateOf ?? ''}</p>
