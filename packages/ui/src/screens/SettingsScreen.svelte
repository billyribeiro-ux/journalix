<script lang="ts">
	import type { SettingsSection } from '../app/routes.ts';
	import { useApp } from '../app/context.ts';
	import Tabs from '../primitives/Tabs.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import GeneralSettings from './settings/GeneralSettings.svelte';
	import MarketDataSettings from './settings/MarketDataSettings.svelte';
	import DataSettings from './settings/DataSettings.svelte';

	interface Props {
		section?: SettingsSection;
	}

	let { section = 'general' }: Props = $props();
	const { env } = useApp();

	const SECTIONS: readonly { value: SettingsSection; label: string }[] = [
		{ value: 'general', label: 'General' },
		{ value: 'market-data', label: 'Market data' },
		{ value: 'data', label: 'Import and export' }
	];

	let current = $derived<SettingsSection>(section);

	function select(next: SettingsSection): void {
		current = next;
		void env.navigate({ name: 'settings', section: next }, { replace: true });
	}
</script>

<PageHeader
	title="Settings"
	description={env.user ? `Signed in as ${env.user.email}.` : 'Stored on this computer.'}
/>

<Tabs label="Settings" value={current} tabs={SECTIONS} onchange={select} />

<div class="body" role="tabpanel" id="panel-{current}" aria-labelledby="tab-{current}">
	{#if current === 'general'}
		<GeneralSettings />
	{:else if current === 'market-data'}
		<MarketDataSettings />
	{:else}
		<DataSettings />
	{/if}
</div>

<style>
	.body {
		margin-top: var(--space-5);
		max-width: 960px;
	}
</style>
