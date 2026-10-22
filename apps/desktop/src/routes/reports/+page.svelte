<script lang="ts">
	import { page } from '$app/state';
	import { ReportsScreen } from '@journalix/ui';
	import { reportTab } from '#lib/params.ts';

	const tab = $derived(reportTab(page.url.searchParams.get('tab')));
</script>

<svelte:head><title>Reports — Journalix</title></svelte:head>

<ReportsScreen {tab} />
