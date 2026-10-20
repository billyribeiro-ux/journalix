import * as v from 'valibot';
import type { RequestHandler } from '@sveltejs/kit';
import { json, readJson, requireUser, rethrow } from '../http.ts';

/** Collection endpoint: GET lists, POST upserts one entity (validated). */
export function collection<S extends v.GenericSchema>(
	schema: S,
	list: (userId: string) => Promise<unknown>,
	save: (userId: string, entity: v.InferOutput<S>) => Promise<unknown>
): { GET: RequestHandler; POST: RequestHandler } {
	return {
		GET: async (event) => {
			const userId = requireUser(event);
			try {
				return json(await list(userId));
			} catch (cause) {
				rethrow(cause);
			}
		},
		POST: async (event) => {
			const userId = requireUser(event);
			const entity = await readJson(event, schema);
			try {
				return json(await save(userId, entity));
			} catch (cause) {
				rethrow(cause);
			}
		}
	};
}

const IdParam = v.pipe(v.string(), v.uuid());

export function parseId(raw: string | undefined): string | null {
	const r = v.safeParse(IdParam, raw);
	return r.success ? r.output : null;
}

/** Item endpoint: DELETE removes one entity by id. */
export function item(remove: (userId: string, id: string) => Promise<void>): {
	DELETE: RequestHandler;
} {
	return {
		DELETE: async (event) => {
			const userId = requireUser(event);
			const id = parseId(event.params['id']);
			if (!id) return json({ message: 'Invalid id' }, 400);
			try {
				await remove(userId, id);
				return new Response(null, { status: 204 });
			} catch (cause) {
				rethrow(cause);
			}
		}
	};
}
