<script lang="ts">
	import type { ReportTab } from '../app/routes.ts';
	interface Props {
		tab?: ReportTab;
	}
	let { tab = 'overview' }: Props = $props();
</script>

<p>ReportsScreen {tab}</p>
