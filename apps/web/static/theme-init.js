// Applies the saved theme before first paint (loaded synchronously from <head>).
try {
	const theme = localStorage.getItem('journalix-theme');
	if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch {
	// Storage can be unavailable (private mode, blocked cookies); the system theme applies.
}
