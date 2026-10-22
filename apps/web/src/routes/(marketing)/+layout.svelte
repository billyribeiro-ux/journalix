<script lang="ts">
	import '#lib/marketing/marketing.css';
	import SiteHeader from '#lib/marketing/SiteHeader.svelte';
	import SiteFooter from '#lib/marketing/SiteFooter.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="mk">
	<div class="scroll-progress" aria-hidden="true"></div>
	<a class="skip-link" href="#main">Skip to content</a>
	<SiteHeader />
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
	<SiteFooter />
</div>
