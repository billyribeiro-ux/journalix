import { UserSettingsSchema } from '@journalix/core';
import type { RequestHandler } from './$types';
import { json, readJson, requireUser } from '#lib/server/http.ts';
import { getSettings, saveSettings } from '#lib/server/journal/store.ts';

export const GET: RequestHandler = async (event) => json(await getSettings(requireUser(event)));

export const PUT: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const settings = await readJson(event, UserSettingsSchema);
	return json(await saveSettings(userId, settings));
};
