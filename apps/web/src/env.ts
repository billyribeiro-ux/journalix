import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';
import * as v from 'valibot';

const required = (description: string) =>
	({
		description,
		schema: building
			? v.optional(v.string())
			: v.pipe(v.string(), v.minLength(1, `${description} is required`))
	}) as const;

export const variables = defineEnvVars({
	DATABASE_URL: required(
		'PostgreSQL connection string, e.g. postgres://user:pass@localhost:5432/strikebook'
	),
	ORIGIN: required('Public origin of the app, e.g. http://localhost:5173'),
	BETTER_AUTH_SECRET: {
		description:
			'Secret that signs session tokens. At least 32 random characters (openssl rand -base64 32).',
		schema: building
			? v.optional(v.string())
			: v.pipe(v.string(), v.minLength(32, 'BETTER_AUTH_SECRET must be at least 32 characters'))
	},
	PROVIDER_KEY_SECRET: {
		description:
			'Key that encrypts stored market-data API keys (AES-256-GCM). 32 bytes, base64 (openssl rand -base64 32).',
		schema: building
			? v.optional(v.string())
			: v.pipe(
					v.string(),
					v.check((value) => {
						try {
							return Buffer.from(value, 'base64').length === 32;
						} catch {
							return false;
						}
					}, 'PROVIDER_KEY_SECRET must be 32 bytes encoded as base64')
				)
	}
});
