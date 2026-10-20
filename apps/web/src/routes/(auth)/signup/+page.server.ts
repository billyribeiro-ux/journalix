import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import * as v from 'valibot';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { AUTH_RULES, authLimiter } from '#lib/server/rate-limit.ts';

const SignupSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter your name'), v.maxLength(80)),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.email('Enter a valid email address'),
		v.maxLength(254)
	),
	password: v.pipe(
		v.string(),
		v.minLength(15, 'Use at least 15 characters — a short phrase works well'),
		v.maxLength(128, 'Use at most 128 characters')
	)
});

const PLANS = ['starter', 'pro', 'desk'] as const;

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, '/app');
	const plan = url.searchParams.get('plan');
	return { plan: PLANS.find((p) => p === plan) ?? null };
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const values = {
			name: String(form.get('name') ?? ''),
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? '')
		};
		const parsed = v.safeParse(SignupSchema, values);
		if (!parsed.success) {
			const field = parsed.issues[0]?.path?.[0]?.key;
			return fail(400, {
				name: values.name,
				email: values.email,
				field: typeof field === 'string' ? field : null,
				message: parsed.issues[0]?.message ?? 'Check the form and try again'
			});
		}
		if (!authLimiter.hit(`sign-up:ip:${getClientAddress()}`, AUTH_RULES.signUpPerAddress).allowed) {
			return fail(429, {
				name: values.name,
				email: values.email,
				field: null,
				message: 'Too many new accounts from this network. Try again later.'
			});
		}
		try {
			await auth.api.signUpEmail({ body: parsed.output, headers: request.headers });
		} catch (error) {
			if (error instanceof APIError) {
				const exists =
					error.body?.code === 'USER_ALREADY_EXISTS' ||
					error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL';
				return fail(400, {
					name: values.name,
					email: values.email,
					field: exists ? 'email' : null,
					message: exists
						? 'An account with this email already exists. Sign in instead.'
						: (error.body?.message ?? 'Could not create the account')
				});
			}
			throw error;
		}
		redirect(303, '/app?welcome=1');
	}
};
