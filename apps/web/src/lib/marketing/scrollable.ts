import type { Attachment } from 'svelte/attachments';

/**
 * Makes a horizontally scrolling wrapper reachable by keyboard, but only while it actually
 * overflows. A scroll container that cannot be focused traps keyboard users out of its overflow
 * (WCAG 2.1.1); one that is always focusable adds a pointless tab stop when everything fits.
 * The region gets a name so screen readers announce what they are scrolling.
 */
export function scrollable(label: string): Attachment<HTMLElement> {
	return (node) => {
		const update = (): void => {
			const overflowing = node.scrollWidth > node.clientWidth + 1;
			if (overflowing) {
				node.tabIndex = 0;
				node.setAttribute('role', 'region');
				node.setAttribute('aria-label', label);
			} else {
				node.removeAttribute('tabindex');
				node.removeAttribute('role');
				node.removeAttribute('aria-label');
			}
		};

		const observer = new ResizeObserver(update);
		observer.observe(node);
		for (const child of node.children) observer.observe(child);
		update();

		return () => {
			observer.disconnect();
		};
	};
}
