<script lang="ts">
	interface Props {
		label?: string;
		size?: number;
	}

	let { label = 'Loading', size = 20 }: Props = $props();
</script>

<span class="spinner" role="status" style:width="{size}px" style:height="{size}px">
	<span class="visually-hidden">{label}</span>
</span>

<style>
	.spinner {
		display: inline-block;
		border: 2px solid var(--color-line-strong);
		border-top-color: var(--color-signal);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
