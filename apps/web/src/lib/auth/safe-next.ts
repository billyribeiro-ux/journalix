/** Only same-site, absolute-path redirects are honoured after sign-in (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = '/app'): string {
	if (!raw) return fallback;
	if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
	try {
		const url = new URL(raw, 'http://local.invalid');
		if (url.origin !== 'http://local.invalid') return fallback;
		// Check the normalised result too: dot segments and backslashes can collapse a harmless
		// looking path such as `/.//evil.com` into the protocol-relative `//evil.com`.
		const path = url.pathname;
		if (path.startsWith('//') || path.startsWith('/\\')) return fallback;
		return path + url.search + url.hash;
	} catch {
		return fallback;
	}
}
