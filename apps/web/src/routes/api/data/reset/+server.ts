import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/http.ts';
import { resetJournal } from '#lib/server/journal/store.ts';

export const POST: RequestHandler = async (event) => {
	await resetJournal(requireUser(event));
	return new Response(null, { status: 204 });
};
