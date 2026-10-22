export type ThemeChoice = 'system' | 'dark' | 'light';

const KEY = 'journalix-theme';

/**
 * Applies a theme to <html> and remembers it for the pre-paint script. A change the visitor can see
 * (not the re-apply on load, which finds the attribute already set) cross-fades instead of cutting,
 * unless the browser has no View Transitions API or motion is reduced.
 */
export function applyTheme(choice: ThemeChoice): void {
	const root = document.documentElement;
	const apply = (): void => {
		if (choice === 'system') delete root.dataset['theme'];
		else root.dataset['theme'] = choice;
	};

	if (
		(root.dataset['theme'] ?? 'system') !== choice &&
		document.startViewTransition &&
		!matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		// `theme-vt` swaps the route-change animation on the `page` region for a plain cross-fade.
		root.classList.add('theme-vt');
		document.startViewTransition(apply).finished.finally(() => root.classList.remove('theme-vt'));
	} else {
		apply();
	}

	try {
		if (choice === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Storage unavailable: the choice still applies for this session.
	}
}
