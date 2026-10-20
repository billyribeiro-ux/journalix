<script lang="ts">
	import { AppShell } from '@journalix/ui';
	import { createHttpRepository } from '#lib/http-repository.ts';
	import { createWebEnv } from '#lib/app-env.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const repo = createHttpRepository();
	const env = $derived(createWebEnv(data.user));
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<AppShell {env} {repo}>
	{@render children()}
</AppShell>
