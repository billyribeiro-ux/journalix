<script lang="ts">
	import '@journalix/ui/styles.css';
	import { onNavigate } from '$app/navigation';
	import { crossfadeRoutes, installReveals } from '@journalix/ui';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => installReveals());

	// Route changes cross-fade the region named `page` (motion.css); the chrome stays put.
	onNavigate(crossfadeRoutes);
</script>

{@render children()}
