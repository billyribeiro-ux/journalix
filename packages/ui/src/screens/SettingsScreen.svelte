<script lang="ts">
	import type { SettingsSection } from '../app/routes.ts';
	interface Props {
		section?: SettingsSection;
	}
	let { section = 'general' }: Props = $props();
</script>

<p>SettingsScreen {section}</p>
