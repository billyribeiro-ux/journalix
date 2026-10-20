<script lang="ts">
	import '@journalix/ui/styles.css';
	import { isTauri } from '@tauri-apps/api/core';
	import { AppShell } from '@journalix/ui';
	import { createDesktopEnv } from '#lib/env.ts';
	import { createTauriRepository } from '#lib/tauri-repository.ts';
	import { createBrowserRepository } from '#lib/browser-repository.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const env = createDesktopEnv();
	// Outside the Tauri webview (plain `pnpm dev` in a browser) fall back to localStorage.
	const repo = isTauri() ? createTauriRepository() : createBrowserRepository();
</script>

<svelte:head>
	<title>Journalix</title>
</svelte:head>

<AppShell {env} {repo}>{@render children()}</AppShell>
