import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/http.ts';
import { exportJournal } from '#lib/server/journal/store.ts';

export const GET: RequestHandler = async (event) => {
	const data = await exportJournal(requireUser(event));
	return Response.json(data, { headers: { 'cache-control': 'no-store' } });
};
