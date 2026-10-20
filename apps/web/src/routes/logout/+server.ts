import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '#lib/server/auth.ts';

/** POST-only sign out, so a cross-site link or prefetch can never end the session. */
export const POST: RequestHandler = async ({ request }) => {
	await auth.api.signOut({ headers: request.headers });
	redirect(303, '/login');
};
