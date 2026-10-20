import type { RequestHandler } from './$types';
import { item, parseId } from '#lib/server/journal/crud.ts';
import { json, requireUser } from '#lib/server/http.ts';
import { getTrade, removeTrade } from '#lib/server/journal/store.ts';

export const GET: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const id = parseId(event.params.id);
	if (!id) return json({ message: 'Invalid id' }, 400);
	const trade = await getTrade(userId, id);
	return trade ? json(trade) : json({ message: 'Trade not found' }, 404);
};

export const { DELETE } = item(removeTrade);
