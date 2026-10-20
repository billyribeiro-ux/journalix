import * as v from 'valibot';
import { BarsRequestSchema } from '@strikebook/core/market-data';
import type { RequestHandler } from './$types';
import { json, readJson, requireUser, rethrow } from '#lib/server/http.ts';
import { getBars } from '#lib/server/journal/providers.ts';

const BodySchema = v.object({
	request: BarsRequestSchema,
	providerId: v.nullable(v.pipe(v.string(), v.uuid()))
});

export const POST: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const body = await readJson(event, BodySchema);
	try {
		return json(await getBars(userId, body.request, body.providerId, globalThis.fetch));
	} catch (cause) {
		rethrow(cause);
	}
};
