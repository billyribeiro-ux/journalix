import { JournalExportSchema } from '@journalix/core';
import type { RequestHandler } from './$types';
import { json, readJson, requireUser, rethrow } from '#lib/server/http.ts';
import { importJournal } from '#lib/server/journal/store.ts';

export const POST: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const data = await readJson(event, JournalExportSchema);
	try {
		return json(await importJournal(userId, data));
	} catch (cause) {
		rethrow(cause);
	}
};
