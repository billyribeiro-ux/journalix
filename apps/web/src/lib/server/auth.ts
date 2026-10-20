import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.ts';

export const auth = betterAuth({
	appName: 'Journalix',
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: {
		enabled: true,
		// NIST SP 800-63B-4: at least 15 characters when a password is the only factor.
		minPasswordLength: 15,
		maxPasswordLength: 128,
		autoSignIn: true
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customRules: {
			'/sign-in/email': { window: 60, max: 8 },
			'/sign-up/email': { window: 60, max: 5 }
		}
	},
	advanced: {
		database: { generateId: () => crypto.randomUUID() }
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // must be the last plugin
	]
});
