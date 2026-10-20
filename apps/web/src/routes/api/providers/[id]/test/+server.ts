import type { RequestHandler } from './$types';
import { parseId } from '#lib/server/journal/crud.ts';
import { json, requireUser, rethrow } from '#lib/server/http.ts';
import { testProvider } from '#lib/server/journal/providers.ts';

export const POST: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const id = parseId(event.params.id);
	if (!id) return json({ message: 'Invalid id' }, 400);
	try {
		// Global fetch, not event.fetch: the provider is an external host.
		return json(await testProvider(userId, id, globalThis.fetch));
	} catch (cause) {
		rethrow(cause);
	}
};
