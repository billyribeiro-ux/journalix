import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.ts';

/** Resolves the Better Auth session onto `locals` and serves `/api/auth/*`. */
const handleAuth: Handle = async ({ event, resolve }) => {
	if (!building) {
		const session = await auth.api.getSession({ headers: event.request.headers });
		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}
	}
	return svelteKitHandler({ event, resolve, auth, building });
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Journal API guard: JSON only, same-origin only for writes (defence in depth on top of the
 * browser's CORS preflight), and never cached.
 */
const handleApi: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
		if (MUTATING.has(event.request.method)) {
			const origin = event.request.headers.get('origin');
			if (origin !== null && origin !== event.url.origin) {
				return Response.json({ message: 'Cross-origin request rejected' }, { status: 403 });
			}
			const type = event.request.headers.get('content-type') ?? '';
			const hasBody =
				event.request.headers.get('content-length') !== '0' && event.request.body !== null;
			if (hasBody && !type.startsWith('application/json')) {
				return Response.json({ message: 'Content-Type must be application/json' }, { status: 415 });
			}
		}
		if (!event.locals.user)
			return Response.json({ message: 'Sign in to continue' }, { status: 401 });
	}
	return resolve(event);
};

const handleHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set(
		'permissions-policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);
	response.headers.set('cross-origin-opener-policy', 'same-origin');
	if (event.url.protocol === 'https:') {
		response.headers.set(
			'strict-transport-security',
			'max-age=63072000; includeSubDomains; preload'
		);
	}
	return response;
};

export const handle: Handle = sequence(handleAuth, handleApi, handleHeaders);
