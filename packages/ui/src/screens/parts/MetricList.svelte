<script lang="ts">
	export interface MetricItem {
		readonly label: string;
		readonly value: string;
		readonly tone?: 'gain' | 'loss' | 'neutral';
		readonly hint?: string;
	}

	interface Props {
		items: readonly MetricItem[];
		columns?: 1 | 2 | 3;
	}

	let { items, columns = 2 }: Props = $props();
</script>

<dl class="metrics cols-{columns}">
	{#each items as item (item.label)}
		<div class="row" title={item.hint}>
			<dt>{item.label}</dt>
			<dd class="num {item.tone ?? ''}">{item.value}</dd>
		</div>
	{/each}
</dl>

<style>
	.metrics {
		display: grid;
		gap: 0 var(--space-6);
	}

	.cols-2 {
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}

	.cols-3 {
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	dt {
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		min-width: 0;
		text-wrap: pretty;
	}

	dd {
		margin: 0;
		font-weight: 500;
		text-align: end;
		white-space: nowrap;
	}

	.gain {
		color: var(--color-gain-text);
	}

	.loss {
		color: var(--color-loss-text);
	}
</style>
