import { error, isHttpError, type RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { RepositoryError } from '@journalix/core';

/** The signed-in user's id, or a 401. */
export function requireUser(event: RequestEvent): string {
	const id = event.locals.user?.id;
	if (!id) error(401, 'Sign in to continue');
	return id;
}

/** Reads and validates a JSON body; a 400 lists the first issues. */
export async function readJson<S extends v.GenericSchema>(
	event: RequestEvent,
	schema: S
): Promise<v.InferOutput<S>> {
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		error(400, 'Request body must be JSON');
	}
	const result = v.safeParse(schema, body);
	if (!result.success) {
		const issues = result.issues.slice(0, 5).map((i) => {
			const path = i.path?.map((p) => String(p.key)).join('.') ?? '';
			return path ? `${path}: ${i.message}` : i.message;
		});
		error(400, `Invalid request: ${issues.join('; ')}`);
	}
	return result.output;
}

export function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

/** Converts domain errors to HTTP errors; rethrows SvelteKit errors untouched. */
export function rethrow(cause: unknown): never {
	if (isHttpError(cause)) throw cause;
	if (cause instanceof RepositoryError) error(cause.status as 400 | 404 | 409, cause.message);
	// A primary or unique key already taken (for example an id reused from another journal).
	if (pgCode(cause) === '23505') error(409, 'An item with this id already exists');
	throw cause;
}

/** PostgreSQL SQLSTATE of a driver error, also when wrapped by Drizzle as `cause`. */
function pgCode(cause: unknown): string | null {
	for (let e: unknown = cause, depth = 0; e && typeof e === 'object' && depth < 4; depth++) {
		const code = (e as { code?: unknown }).code;
		if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
		e = (e as { cause?: unknown }).cause;
	}
	return null;
}
