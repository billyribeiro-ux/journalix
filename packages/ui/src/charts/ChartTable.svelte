<script lang="ts">
	import type { TableRow } from './chart-utils.ts';

	interface Props {
		caption: string;
		columns: readonly string[];
		rows: readonly TableRow[];
	}

	let { caption, columns, rows }: Props = $props();
</script>

<div class="visually-hidden">
	<table>
		<caption>{caption}</caption>
		<thead>
			<tr>
				{#each columns as column (column)}
					<th scope="col">{column}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr>
					{#each row.cells as cell, i (i)}
						{#if i === 0}
							<th scope="row">{cell}</th>
						{:else}
							<td>{cell}</td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
