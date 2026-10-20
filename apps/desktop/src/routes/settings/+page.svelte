<script lang="ts">
	import { page } from '$app/state';
	import { SettingsScreen } from '@strikebook/ui';
	import { settingsSection } from '#lib/params.ts';

	const section = $derived(settingsSection(page.url.searchParams.get('section')));
</script>

<SettingsScreen {section} />
