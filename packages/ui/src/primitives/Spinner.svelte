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
		flex: none;
		border: 2px solid var(--color-line-strong);
		border-top-color: var(--color-signal-fg);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* A spinner is feedback, not decoration: under reduced motion it turns slowly instead of freezing. */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: spin 1.6s linear infinite !important;
		}
	}

	@media (forced-colors: active) {
		.spinner {
			border-color: GrayText;
			border-top-color: Highlight;
		}
	}
</style>
