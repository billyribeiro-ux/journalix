import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import * as v from 'valibot';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { safeNext } from '#lib/auth/safe-next.ts';
import { AUTH_RULES, authLimiter } from '#lib/server/rate-limit.ts';

const LoginSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.email('Enter a valid email address'),
		v.maxLength(254)
	),
	password: v.pipe(v.string(), v.minLength(1, 'Enter your password'), v.maxLength(128))
});

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	default: async ({ request, url, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = v.safeParse(LoginSchema, {
			email,
			password: String(form.get('password') ?? '')
		});
		if (!parsed.success) {
			return fail(400, {
				email,
				message: parsed.issues[0]?.message ?? 'Check the form and try again'
			});
		}
		const tooMany = fail(429, {
			email: parsed.output.email,
			message: 'Too many attempts. Wait a few minutes and try again.'
		});
		if (!authLimiter.hit(`sign-in:ip:${getClientAddress()}`, AUTH_RULES.signInPerAddress).allowed) {
			return tooMany;
		}
		const emailKey = `sign-in:email:${parsed.output.email}`;
		if (!authLimiter.hit(emailKey, AUTH_RULES.signInPerEmail).allowed) return tooMany;
		try {
			await auth.api.signInEmail({ body: parsed.output, headers: request.headers });
			authLimiter.reset(emailKey);
		} catch (error) {
			if (error instanceof APIError) {
				const message =
					error.status === 'TOO_MANY_REQUESTS'
						? 'Too many attempts. Wait a minute and try again.'
						: 'Email or password is incorrect';
				return fail(error.status === 'TOO_MANY_REQUESTS' ? 429 : 400, {
					email: parsed.output.email,
					message
				});
			}
			throw error;
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
