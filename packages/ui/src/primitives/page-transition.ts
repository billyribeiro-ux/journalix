/**
 * Route-change cross-fade for SvelteKit's `onNavigate` (the kit lives in each app, so this takes the
 * navigation by shape instead of importing it):
 *
 *   onNavigate(crossfadeRoutes);
 *
 * Wraps the navigation in a View Transition. Only the element named `page` (styles/motion.css) visibly
 * animates; the header, sidebar and footer are identical in both snapshots and stay put. Does nothing
 * when the browser has no View Transitions API or the visitor prefers reduced motion.
 */
export function crossfadeRoutes(navigation: { complete: Promise<void> }): Promise<void> | void {
	if (typeof document === 'undefined' || !document.startViewTransition) return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	return new Promise((done) => {
		document.startViewTransition(async () => {
			done();
			await navigation.complete;
		});
	});
}
