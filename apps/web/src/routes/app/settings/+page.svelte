<script lang="ts">
	import { page } from '$app/state';
	import { SettingsScreen, type SettingsSection } from '@journalix/ui';

	const SECTIONS: readonly SettingsSection[] = ['general', 'market-data', 'data'];
	const section = $derived(
		SECTIONS.find((s) => s === page.url.searchParams.get('section')) ?? 'general'
	);
</script>

<svelte:head><title>Settings — Journalix</title></svelte:head>
<SettingsScreen {section} />
