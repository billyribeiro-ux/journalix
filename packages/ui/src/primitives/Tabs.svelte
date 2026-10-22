<script lang="ts" generics="T extends string">
	interface Props {
		value: T;
		tabs: readonly { readonly value: T; readonly label: string; readonly count?: number }[];
		label: string;
		onchange?: (value: T) => void;
	}

	let { value = $bindable(), tabs, label, onchange }: Props = $props();

	function select(next: T): void {
		value = next;
		onchange?.(next);
	}

	function onkeydown(event: KeyboardEvent): void {
		const index = tabs.findIndex((t) => t.value === value);
		const keyed: Record<string, number> = {
			ArrowRight: (index + 1) % tabs.length,
			ArrowLeft: (index - 1 + tabs.length) % tabs.length,
			Home: 0,
			End: tabs.length - 1
		};
		const next = keyed[event.key];
		if (next === undefined) return;
		event.preventDefault();
		const tab = tabs[next];
		if (tab) {
			select(tab.value);
			(event.currentTarget as HTMLElement)
				.querySelectorAll<HTMLButtonElement>('[role="tab"]')
				[next]?.focus();
		}
	}
</script>

<div class="tabs" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
	{#each tabs as tab (tab.value)}
		<button
			type="button"
			role="tab"
			id="tab-{tab.value}"
			aria-selected={tab.value === value}
			aria-controls="panel-{tab.value}"
			tabindex={tab.value === value ? 0 : -1}
			onclick={() => select(tab.value)}
		>
			{tab.label}
			{#if tab.count !== undefined}<span class="count num">{tab.count}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: var(--space-5);
		border-bottom: 1px solid var(--color-line);
		overflow-x: auto;
		scrollbar-width: none;
	}

	button {
		position: relative;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		padding: var(--space-3) 0;
		color: var(--color-ink-3);
		font-size: var(--text-base);
		font-weight: 500;
		line-height: var(--leading-snug);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		transition: color var(--duration-fast) var(--ease-out);
	}

	@media (pointer: coarse) {
		button {
			min-height: var(--control-touch);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover {
			color: var(--color-ink);
			transition-delay: var(--hover-delay-tint);
		}
	}

	button:focus-visible,
	button:active {
		transition-delay: 0s;
	}

	/* The tab strip scrolls, so the ring sits inside it rather than being clipped. */
	button:focus-visible {
		outline-offset: -2px;
	}

	button[aria-selected='true'] {
		color: var(--color-ink);
	}

	button::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		bottom: -1px;
		height: 2px;
		background: var(--color-signal);
		transform: scaleX(0);
		transition: transform var(--duration-base) var(--ease-out-strong);
	}

	button[aria-selected='true']::after {
		transform: scaleX(1);
	}

	.count {
		font-size: var(--text-xs);
		color: var(--color-ink-3);
	}

	@media (forced-colors: active) {
		button::after {
			forced-color-adjust: none;
			background: Highlight;
		}
	}
</style>
