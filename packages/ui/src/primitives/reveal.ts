/**
 * Scroll reveals for any element carrying `data-reveal` (styles/motion.css owns the look).
 *
 *   <section data-reveal>                  rises and fades in as it scrolls into view
 *   <div data-reveal="fade|scale|left|right">   other entrances
 *   <li data-reveal style="--reveal-delay: 120ms">   an explicit delay (skips the automatic stagger)
 *
 * One delegated controller serves the whole document, so markup stays declarative and nodes added
 * later (a screen that renders once the journal has loaded) are picked up by a MutationObserver.
 *
 *  - Hidden only when scripting is on and motion is not reduced (motion.css), so server-rendered
 *    HTML, no-JS visitors and reduced-motion users always see the content. If this controller never
 *    runs, a CSS fail-safe un-hides everything after a few seconds.
 *  - Elements that enter together (a row of cards) are staggered in reading order, capped so the last
 *    one never waits long. The stagger is a CSS custom property, so it costs no timers.
 *  - Reveals once. An element that is already above the viewport when first seen (anchor jump,
 *    restored scroll position) is marked revealed without an animation nobody could see.
 */
const STATE = 'data-reveal-state';
const SELECTOR = '[data-reveal]';
const STAGGER_MS = 70;
const STAGGER_CAP = 6;

let installs = 0;
let uninstall: (() => void) | null = null;

function start(): () => void {
	const io = new IntersectionObserver(
		(entries) => {
			const entering = entries
				.filter((entry) => entry.isIntersecting)
				.sort((a, b) => {
					const [ra, rb] = [a.boundingClientRect, b.boundingClientRect];
					return ra.top - rb.top || ra.left - rb.left;
				});
			entering.forEach((entry, index) => {
				const el = entry.target as HTMLElement;
				if (!el.style.getPropertyValue('--reveal-delay')) {
					el.style.setProperty('--reveal-delay', `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms`);
				}
				el.setAttribute(STATE, 'in');
				io.unobserve(el);
			});
			for (const entry of entries) {
				// Scrolled past before it was ever seen: nothing to animate.
				if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
					entry.target.setAttribute(STATE, 'in');
					io.unobserve(entry.target);
				}
			}
		},
		// The bottom 10% of the viewport is not "in view" yet, so an entrance is actually seen.
		{ rootMargin: '0px 0px -10% 0px', threshold: 0 }
	);

	function watch(node: Node) {
		if (!(node instanceof Element)) return;
		if (node.matches(SELECTOR) && !node.hasAttribute(STATE)) io.observe(node);
		for (const child of node.querySelectorAll(SELECTOR)) {
			if (!child.hasAttribute(STATE)) io.observe(child);
		}
	}

	const mo = new MutationObserver((records) => {
		for (const record of records) for (const added of record.addedNodes) watch(added);
	});

	watch(document.body);
	mo.observe(document.body, { childList: true, subtree: true });

	return () => {
		mo.disconnect();
		io.disconnect();
	};
}

/** Start the controller (reference-counted, safe to call from several layouts). Returns a cleanup. */
export function installReveals(): () => void {
	if (typeof document === 'undefined' || typeof IntersectionObserver === 'undefined') {
		return () => undefined;
	}
	if (installs++ === 0) uninstall = start();
	return () => {
		if (--installs === 0) {
			uninstall?.();
			uninstall = null;
		}
	};
}
