// Applies saved UI preferences before first paint (loaded synchronously from <head>), so the page
// never renders one state and then flips to the saved one. The CSS keys off these <html> attributes.
try {
	const theme = localStorage.getItem('journalix-theme');
	if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
	// Desktop icon rail (AppShell). Narrow screens ignore it in CSS.
	if (localStorage.getItem('journalix-sidebar') === 'collapsed')
		document.documentElement.dataset.sidebar = 'collapsed';
} catch {
	// Storage can be unavailable (private mode, blocked cookies); the system theme and an expanded rail apply.
}
