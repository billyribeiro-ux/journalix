/**
 * Browser implementation of the journal repository for the web app: a thin, typed client for
 * `/api/*`. Requests are validated before sending and responses validated on arrival, so the
 * screens only ever see well-formed data.
 */
import * as v from 'valibot';
import {
	AccountSchema,
	JournalExportSchema,
	NoteSchema,
	PlaybookSchema,
	ProviderConfigInputSchema,
	ProviderConfigViewSchema,
	RepositoryError,
	TagSchema,
	TradeSchema,
	UserSettingsSchema,
	type CrudStore,
	type JournalRepository,
	type ProviderTestResult
} from '@strikebook/core';
import { BarsRequestSchema, BarsResultSchema, type BarsResult } from '@strikebook/core/market-data';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request(method: Method, path: string, body?: unknown): Promise<unknown> {
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			headers:
				body === undefined
					? { accept: 'application/json' }
					: { accept: 'application/json', 'content-type': 'application/json' },
			body: body === undefined ? null : JSON.stringify(body),
			credentials: 'same-origin'
		});
	} catch {
		throw new RepositoryError(
			'Could not reach the server. Check your connection and try again.',
			0
		);
	}
	if (res.status === 204) return null;
	const data: unknown = await res.json().catch(() => null);
	if (!res.ok) {
		const message =
			data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
				? data.message
				: `Request failed (${res.status})`;
		if (res.status === 401 && typeof window !== 'undefined') {
			window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
		}
		throw new RepositoryError(message, res.status);
	}
	return data;
}

function parse<S extends v.GenericSchema>(schema: S, data: unknown): v.InferOutput<S> {
	const result = v.safeParse(schema, data);
	if (!result.success)
		throw new RepositoryError('The server returned data in an unexpected shape', 502);
	return result.output;
}

function crud<T extends { readonly id: string }>(
	base: string,
	schema: v.GenericSchema<unknown, T>
): CrudStore<T> {
	return {
		async list() {
			return parse(v.array(schema), await request('GET', base));
		},
		async save(entity) {
			return parse(schema, await request('POST', base, v.parse(schema, entity)));
		},
		async remove(id) {
			await request('DELETE', `${base}/${encodeURIComponent(id)}`);
		}
	};
}

const TestResultSchema = v.object({
	ok: v.boolean(),
	message: v.string(),
	bars: v.optional(v.number())
});

export function createHttpRepository(): JournalRepository {
	const trades = crud('/api/trades', TradeSchema);
	return {
		kind: 'web',
		accounts: crud('/api/accounts', AccountSchema),
		trades: {
			...trades,
			async get(id) {
				try {
					return parse(TradeSchema, await request('GET', `/api/trades/${encodeURIComponent(id)}`));
				} catch (error) {
					if (error instanceof RepositoryError && error.status === 404) return null;
					throw error;
				}
			}
		},
		tags: crud('/api/tags', TagSchema),
		playbooks: crud('/api/playbooks', PlaybookSchema),
		notes: crud('/api/notes', NoteSchema),
		settings: {
			async get() {
				return parse(UserSettingsSchema, await request('GET', '/api/settings'));
			},
			async save(settings) {
				return parse(
					UserSettingsSchema,
					await request('PUT', '/api/settings', v.parse(UserSettingsSchema, settings))
				);
			}
		},
		providers: {
			async list() {
				return parse(v.array(ProviderConfigViewSchema), await request('GET', '/api/providers'));
			},
			async save(input) {
				return parse(
					ProviderConfigViewSchema,
					await request('POST', '/api/providers', v.parse(ProviderConfigInputSchema, input))
				);
			},
			async remove(id) {
				await request('DELETE', `/api/providers/${encodeURIComponent(id)}`);
			},
			async test(id): Promise<ProviderTestResult> {
				const r = parse(
					TestResultSchema,
					await request('POST', `/api/providers/${encodeURIComponent(id)}/test`, {})
				);
				return r.bars === undefined
					? { ok: r.ok, message: r.message }
					: { ok: r.ok, message: r.message, bars: r.bars };
			}
		},
		bars: {
			async get(barsRequest, providerId = null): Promise<BarsResult> {
				const body = { request: v.parse(BarsRequestSchema, barsRequest), providerId };
				return parse(BarsResultSchema, await request('POST', '/api/bars', body));
			}
		},
		data: {
			async exportAll() {
				return parse(JournalExportSchema, await request('GET', '/api/data/export'));
			},
			async importAll(data) {
				return parse(
					v.object({ trades: v.number() }),
					await request('POST', '/api/data/import', v.parse(JournalExportSchema, data))
				);
			},
			async reset() {
				await request('POST', '/api/data/reset', {});
			}
		}
	};
}
