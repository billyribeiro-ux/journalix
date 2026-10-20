<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { JournalRepository } from '@strikebook/core';
	import type { AppEnv } from '../app/routes.ts';

	interface Props {
		env: AppEnv;
		repo: JournalRepository;
		children: Snippet;
	}

	let { env, repo, children }: Props = $props();
</script>

<div data-platform={env.platform} data-repo={repo.kind}>{@render children()}</div>
