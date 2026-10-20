<script lang="ts">
	import { page } from '$app/state';
	import { ReportsScreen } from '@strikebook/ui';
	import { reportTab } from '#lib/params.ts';

	const tab = $derived(reportTab(page.url.searchParams.get('tab')));
</script>

<ReportsScreen {tab} />
