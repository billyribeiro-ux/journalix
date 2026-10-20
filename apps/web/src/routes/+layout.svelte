<script lang="ts">
	import '@strikebook/ui/styles.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
