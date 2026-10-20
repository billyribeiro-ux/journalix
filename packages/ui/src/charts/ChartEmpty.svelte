<script lang="ts">
	interface Props {
		message: string;
		height: number;
	}

	let { message, height }: Props = $props();
</script>

<div class="empty" style:min-height="{height}px">
	<p>{message}</p>
</div>

<style>
	.empty {
		display: grid;
		place-items: center;
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		text-align: center;
	}

	p {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}
</style>
