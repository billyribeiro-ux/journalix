<script lang="ts">
	import type { PostBlock } from '#lib/marketing/posts/types.ts';
	import { scrollable } from '#lib/marketing/scrollable.ts';

	interface Props {
		blocks: readonly PostBlock[];
	}

	let { blocks }: Props = $props();
</script>

<div class="prose post-body">
	{#each blocks as block, index (index)}
		{#if block.type === 'p'}
			<p>{block.text}</p>
		{:else if block.type === 'h2'}
			<h2 id={block.id}>{block.text}</h2>
		{:else if block.type === 'ul'}
			<ul>
				{#each block.items as item (item)}
					<li>{item}</li>
				{/each}
			</ul>
		{:else if block.type === 'ol'}
			<ol>
				{#each block.items as item (item)}
					<li>{item}</li>
				{/each}
			</ol>
		{:else if block.type === 'quote'}
			<blockquote><p>{block.text}</p></blockquote>
		{:else if block.type === 'formula'}
			<figure class="formula" {@attach scrollable('Formula, scrolls sideways')}>
				<p class="expr">{block.text}</p>
				{#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
			</figure>
		{:else if block.type === 'table'}
			<div class="table-wrap" {@attach scrollable(`${block.caption}, scrolls sideways`)}>
				<table>
					<caption>{block.caption}</caption>
					<thead>
						<tr>
							{#each block.head as cell, c (c)}
								<th scope="col" class={{ r: block.numeric?.includes(c) }}>{cell}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each block.rows as row, r (r)}
							<tr>
								{#each row as cell, c (c)}
									<td class={{ r: block.numeric?.includes(c) }}>{cell}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/each}
</div>

<style>
	blockquote {
		margin: var(--space-8) 0;
		padding-left: var(--space-5);
		border-left: 2px solid var(--color-ink);
		color: var(--color-ink);
		font-size: var(--text-lg);
		line-height: var(--leading-snug);
	}

	.formula {
		margin: var(--space-6) 0;
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		overflow-x: auto;
	}

	.expr {
		color: var(--color-ink);
		font-size: var(--text-md);
		font-weight: 500;
		white-space: pre-wrap;
		font-variant-numeric: tabular-nums;
	}

	.formula figcaption {
		margin-top: var(--space-2);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
	}

	.table-wrap {
		margin: var(--space-6) 0;
		overflow-x: auto;
	}

	table {
		width: 100%;
		font-size: var(--text-sm);
	}

	caption {
		padding-bottom: var(--space-2);
		color: var(--color-ink-3);
		font-size: var(--text-sm);
		text-align: left;
	}

	th,
	td {
		padding: var(--space-2) var(--space-3) var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
		text-align: left;
		white-space: nowrap;
	}

	thead th {
		border-bottom-color: var(--color-ink);
		color: var(--color-ink);
		font-weight: 600;
	}

	td {
		color: var(--color-ink-2);
	}

	.r {
		text-align: right;
	}

	th:last-child,
	td:last-child {
		padding-right: 0;
	}
</style>
