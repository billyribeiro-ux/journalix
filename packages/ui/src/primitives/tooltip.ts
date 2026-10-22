/**
 * Tooltips for any element carrying `data-tip="Label"` (and optionally `data-tip-pos`).
 *
 * One delegated controller owns a single `position: fixed` tooltip element, so it:
 *  - never contributes to scrollable overflow and is clamped to the viewport (WCAG 1.4.10 reflow),
 *  - is dismissible with Escape without moving pointer or focus (WCAG 1.4.13),
 *  - stays open while the pointer moves from the host onto the tooltip (hoverable),
 *  - stays until hover/focus leaves (persistent).
 *
 * Timing follows the hover-intent tokens in styles/tokens.css: `--hover-delay-tooltip` for a cold
 * open, 0 when another tooltip is open or closed within `--hover-warm-window`, no delay at all for
 * keyboard focus, and the close starts immediately. Touch never shows tooltips.
 *
 * Use the `tip()` attachment, or put the attributes on an element and call `installTooltips()` once
 * (AppShell does).
 */
import type { Attachment } from 'svelte/attachments';

export type TipPosition = 'top' | 'bottom' | 'start' | 'end' | 'side';

const MARGIN = 8;
const GAP = 6;
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

let installs = 0;
let uninstall: (() => void) | null = null;

function cssMs(name: string): number {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return 0;
	return raw.endsWith('ms') ? value : value * 1000;
}

function start(): () => void {
	let tipEl: HTMLDivElement | null = null;
	let host: HTMLElement | null = null;
	let openTimer: ReturnType<typeof setTimeout> | undefined;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let watchTimer: ReturnType<typeof setInterval> | undefined;
	let warmUntil = 0;
	/** The host whose tooltip was dismissed (Escape / press); suppressed until hover or focus leaves it. */
	let dismissed: HTMLElement | null = null;
	let via: 'hover' | 'focus' = 'hover';

	function element(): HTMLDivElement {
		if (!tipEl) {
			tipEl = document.createElement('div');
			tipEl.className = 'jx-tip';
			tipEl.setAttribute('role', 'tooltip');
			// The text repeats the host's accessible name, so assistive tech must not read it twice.
			tipEl.setAttribute('aria-hidden', 'true');
			tipEl.popover = 'manual';
			tipEl.addEventListener('pointerleave', (event) => {
				const to = event.relatedTarget;
				if (via === 'hover' && !(to instanceof Node && host?.contains(to))) hide(false);
			});
			document.body.append(tipEl);
		}
		return tipEl;
	}

	const isOpen = (): boolean => tipEl?.classList.contains('is-open') ?? false;

	function place(target: HTMLElement, el: HTMLDivElement): void {
		const pos = (target.dataset['tipPos'] as TipPosition | undefined) ?? 'top';
		const r = target.getBoundingClientRect();
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		const vw = document.documentElement.clientWidth;
		const vh = window.innerHeight;
		const rtl = getComputedStyle(target).direction === 'rtl';
		// `side` is where the tooltip sits relative to the host; it picks the hover bridge and offset.
		let side: 'top' | 'bottom' | 'left' | 'right';
		let x: number;
		let y: number;
		if (pos === 'side') {
			const after = rtl ? r.left - w - GAP : r.right + GAP;
			const before = rtl ? r.right + GAP : r.left - w - GAP;
			const fitsAfter = rtl ? after >= MARGIN : after + w <= vw - MARGIN;
			x = fitsAfter ? after : before;
			y = r.top + r.height / 2 - h / 2;
			side = x >= r.right ? 'right' : 'left';
		} else {
			x = r.left + r.width / 2 - w / 2;
			if (pos === 'start') x = rtl ? r.right - w : r.left;
			else if (pos === 'end') x = rtl ? r.left : r.right - w;
			const above = r.top - h - GAP;
			const below = r.bottom + GAP;
			const preferBelow = pos === 'bottom';
			const fitsAbove = above >= MARGIN;
			const fitsBelow = below + h <= vh - MARGIN;
			const placeBelow = preferBelow ? fitsBelow || !fitsAbove : !fitsAbove && fitsBelow;
			y = placeBelow ? below : above;
			side = placeBelow ? 'bottom' : 'top';
		}
		x = Math.min(Math.max(x, MARGIN), Math.max(MARGIN, vw - w - MARGIN));
		y = Math.min(Math.max(y, MARGIN), Math.max(MARGIN, vh - h - MARGIN));
		el.style.left = `${Math.round(x)}px`;
		el.style.top = `${Math.round(y)}px`;
		el.dataset['side'] = side;
	}

	function show(target: HTMLElement, how: 'hover' | 'focus'): void {
		const text = target.dataset['tip'];
		if (!text || target === dismissed) return;
		clearTimeout(openTimer);
		const el = element();
		host = target;
		via = how;
		el.textContent = text;
		// Inside a modal dialog everything outside it is inert, so the tooltip must live in the
		// dialog to be hoverable; elsewhere it lives in <body>.
		const parent = target.closest('dialog') ?? document.body;
		if (el.parentElement !== parent) {
			try {
				if (el.matches(':popover-open')) el.hidePopover();
			} catch {
				// Not a popover.
			}
			parent.append(el);
		}
		if (!isOpen()) {
			clearTimeout(closeTimer);
			// Top layer, so a tooltip inside a modal dialog is not painted underneath it.
			try {
				if (el.matches(':popover-open')) el.hidePopover();
				el.showPopover();
			} catch {
				// No Popover API: the element is `position: fixed` and still shows.
			}
		}
		place(target, el);
		el.classList.add('is-open');
		clearInterval(watchTimer);
		// A host removed from the page (a row deleted from the keyboard) fires no blur: close with it.
		watchTimer = setInterval(() => {
			if (!host?.isConnected || host.getClientRects().length === 0) hide(false);
		}, 250);
	}

	function hide(suppress: boolean): void {
		clearTimeout(openTimer);
		clearInterval(watchTimer);
		if (suppress && host) dismissed = host;
		if (isOpen()) {
			tipEl?.classList.remove('is-open');
			warmUntil = performance.now() + cssMs('--hover-warm-window');
			// Leave the top layer once the fade-out has finished.
			closeTimer = setTimeout(
				() => {
					try {
						if (!isOpen()) tipEl?.hidePopover();
					} catch {
						// Not a popover.
					}
				},
				cssMs('--duration-fast') + 40
			);
		}
		host = null;
	}

	function schedule(target: HTMLElement): void {
		clearTimeout(openTimer);
		if (target === dismissed) return;
		const warm = isOpen() || performance.now() < warmUntil;
		const delay = warm ? 0 : cssMs('--hover-delay-tooltip');
		if (delay <= 0) show(target, 'hover');
		else openTimer = setTimeout(() => show(target, 'hover'), delay);
	}

	const hostOf = (node: EventTarget | null): HTMLElement | null =>
		node instanceof Element ? node.closest<HTMLElement>('[data-tip]') : null;
	const insideTip = (node: EventTarget | null): boolean =>
		node instanceof Node && !!tipEl?.contains(node);

	function onpointerover(event: PointerEvent): void {
		if (event.pointerType === 'touch' || !window.matchMedia(HOVER_QUERY).matches) return;
		if (insideTip(event.target)) {
			clearTimeout(openTimer);
			return;
		}
		const target = hostOf(event.target);
		if (target && target !== host) schedule(target);
	}

	function onpointerout(event: PointerEvent): void {
		const from = hostOf(event.target);
		const to = event.relatedTarget;
		if (from && from === dismissed && !(to instanceof Node && from.contains(to))) dismissed = null;
		if (!from) return;
		// Still on the same host, or moving host -> tooltip: nothing to do.
		if (to instanceof Node && (from.contains(to) || insideTip(to))) return;
		if (from !== host) {
			clearTimeout(openTimer); // a tooltip that was still waiting to open
			return;
		}
		if (via === 'hover') hide(false);
	}

	function onfocusin(event: FocusEvent): void {
		const target = hostOf(event.target);
		if (target && target.matches(':focus-visible')) show(target, 'focus');
	}

	function onfocusout(event: FocusEvent): void {
		const target = hostOf(event.target);
		if (target && target === dismissed) dismissed = null;
		if (target && target === host && via === 'focus') hide(false);
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !host || !isOpen()) return;
		// Dismiss the tooltip only; focus and pointer stay where they are. The next Escape reaches
		// whatever was listening (dialog, menu).
		event.preventDefault();
		event.stopPropagation();
		hide(true);
	}

	function onpointerdown(): void {
		if (host) hide(true);
	}

	const dismissAll = (): void => {
		if (host) hide(false);
	};

	document.addEventListener('pointerover', onpointerover, true);
	document.addEventListener('pointerout', onpointerout, true);
	document.addEventListener('focusin', onfocusin, true);
	document.addEventListener('focusout', onfocusout, true);
	document.addEventListener('keydown', onkeydown, true);
	document.addEventListener('pointerdown', onpointerdown, true);
	document.addEventListener('scroll', dismissAll, true);
	window.addEventListener('resize', dismissAll);

	return () => {
		document.removeEventListener('pointerover', onpointerover, true);
		document.removeEventListener('pointerout', onpointerout, true);
		document.removeEventListener('focusin', onfocusin, true);
		document.removeEventListener('focusout', onfocusout, true);
		document.removeEventListener('keydown', onkeydown, true);
		document.removeEventListener('pointerdown', onpointerdown, true);
		document.removeEventListener('scroll', dismissAll, true);
		window.removeEventListener('resize', dismissAll);
		clearTimeout(openTimer);
		clearInterval(watchTimer);
		clearTimeout(closeTimer);
		tipEl?.remove();
	};
}

/** Installs the delegated controller (reference-counted). Returns the matching release function. */
export function installTooltips(): () => void {
	if (typeof document === 'undefined') return () => {};
	if (installs++ === 0) uninstall = start();
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--installs === 0) {
			uninstall?.();
			uninstall = null;
		}
	};
}

/**
 * Attachment: gives the element a tooltip. `{@attach tip(label)}`; pass `undefined` for none, and a
 * placement only when it differs from the default (a `data-tip-pos` attribute set elsewhere wins).
 */
export function tip(
	text: string | undefined,
	position?: TipPosition
): Attachment<HTMLElement> | undefined {
	if (!text) return undefined;
	return (element) => {
		element.dataset['tip'] = text;
		if (position) element.dataset['tipPos'] = position;
		const release = installTooltips();
		return () => {
			delete element.dataset['tip'];
			if (position) delete element.dataset['tipPos'];
			release();
		};
	};
}
