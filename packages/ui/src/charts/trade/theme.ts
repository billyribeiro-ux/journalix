/** Reads design tokens from CSS so the canvas chart follows the active theme. */
export interface ChartTheme {
	readonly surface: string;
	readonly text: string;
	readonly grid: string;
	readonly axis: string;
	readonly crosshair: string;
	readonly gain: string;
	readonly loss: string;
	readonly neutral: string;
	readonly signal: string;
	readonly entry: string;
	readonly ink: string;
	readonly ink2: string;
	readonly ink3: string;
	readonly series1: string;
	readonly font: string;
}

export function readTheme(element: Element): ChartTheme {
	const style = getComputedStyle(element);
	const get = (name: string, fallback: string): string =>
		style.getPropertyValue(name).trim() || fallback;
	return {
		surface: get('--color-surface', '#0f1b2d'),
		text: get('--chart-text', '#8193ab'),
		grid: get('--chart-grid', '#1a2a41'),
		axis: get('--chart-axis', '#2b3f5d'),
		crosshair: get('--chart-crosshair', '#b4c1d3'),
		gain: get('--color-gain', '#00a99c'),
		loss: get('--color-loss', '#dd503f'),
		neutral: get('--color-neutral', '#7d8ea6'),
		signal: get('--color-signal', '#f2c14e'),
		entry: get('--chart-entry', '#9a6f00'),
		ink: get('--color-ink', '#e7edf5'),
		ink2: get('--color-ink-2', '#b4c1d3'),
		ink3: get('--color-ink-3', '#8193ab'),
		series1: get('--series-1', '#4f91e2'),
		font: get('--font-sans', 'sans-serif')
	};
}

/** Adds alpha to a #rrggbb colour. */
export function withAlpha(hex: string, alpha: number): string {
	const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m || !m[1]) return hex;
	const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
		.toString(16)
		.padStart(2, '0');
	return `#${m[1]}${a}`;
}

/** Calls `onchange` whenever the light/dark theme changes. Returns a disposer. */
export function watchTheme(onchange: () => void): () => void {
	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const observer = new MutationObserver(onchange);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	media.addEventListener('change', onchange);
	return () => {
		observer.disconnect();
		media.removeEventListener('change', onchange);
	};
}
