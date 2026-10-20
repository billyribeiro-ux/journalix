<script lang="ts">
	import Dialog from './Dialog.svelte';
	import Button from './Button.svelte';

	interface Props {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		tone?: 'danger' | 'primary';
		onconfirm: () => Promise<void> | void;
	}

	let { open = $bindable(false), title, message, confirmLabel, tone = 'danger', onconfirm }: Props = $props();
	let busy = $state(false);

	async function confirm(): Promise<void> {
		busy = true;
		try {
			await onconfirm();
			open = false;
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open {title} size="sm">
	<p class="message">{message}</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button variant={tone} {busy} onclick={confirm}>{confirmLabel}</Button>
	{/snippet}
</Dialog>

<style>
	.message {
		color: var(--color-ink-2);
	}
</style>
