export type ThemeChoice = 'system' | 'dark' | 'light';

const KEY = 'strikebook-theme';

/** Applies a theme to <html> and remembers it for the pre-paint script. */
export function applyTheme(choice: ThemeChoice): void {
	const root = document.documentElement;
	if (choice === 'system') delete root.dataset['theme'];
	else root.dataset['theme'] = choice;
	try {
		if (choice === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Storage unavailable: the choice still applies for this session.
	}
}
