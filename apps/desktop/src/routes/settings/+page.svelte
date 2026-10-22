<script lang="ts">
	import { page } from '$app/state';
	import { SettingsScreen } from '@journalix/ui';
	import { settingsSection } from '#lib/params.ts';

	const section = $derived(settingsSection(page.url.searchParams.get('section')));
</script>

<svelte:head><title>Settings — Journalix</title></svelte:head>

<SettingsScreen {section} />
