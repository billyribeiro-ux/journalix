<script lang="ts">
	import { page } from '$app/state';
	import { ReportsScreen, type ReportTab } from '@strikebook/ui';

	const TABS: readonly ReportTab[] = ['overview', 'options', 'time', 'risk', 'tags', 'symbols'];
	const tab = $derived(TABS.find((t) => t === page.url.searchParams.get('tab')) ?? 'overview');
</script>

<svelte:head><title>Reports — Strikebook</title></svelte:head>
<ReportsScreen {tab} />
