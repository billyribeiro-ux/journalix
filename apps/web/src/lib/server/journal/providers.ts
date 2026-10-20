/**
 * Market-data provider configurations and the cached bars service.
 * Secrets are encrypted before they reach the database and are decrypted only inside the
 * request that calls the provider; they never leave the server.
 */
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import * as v from 'valibot';
import {
	ProviderSecretSchema,
	RepositoryError,
	type ProviderConfigInput,
	type ProviderConfigView,
	type ProviderSecret,
	type ProviderTestResult
} from '@journalix/core';
import {
	createBarsService,
	getProvider,
	type BarsCache,
	type BarsRequest,
	type BarsResult,
	type ResolvedProvider,
	TIMEFRAME_SECONDS
} from '@journalix/core/market-data';
import { db } from '../db/index.ts';
import { barCache, barCoverage, providerConfig } from '../db/schema.ts';
import { decryptSecret, encryptSecret, secretHint } from '../crypto.ts';

type Row = typeof providerConfig.$inferSelect;

function toView(r: Row): ProviderConfigView {
	return {
		id: r.id,
		provider: r.provider,
		label: r.label,
		options: r.options,
		isDefault: r.isDefault,
		secretHint: r.secretHint,
		createdAt: r.createdAt.toISOString(),
		updatedAt: r.updatedAt.toISOString()
	};
}

export async function listProviders(userId: string): Promise<ProviderConfigView[]> {
	const rows = await db
		.select()
		.from(providerConfig)
		.where(eq(providerConfig.userId, userId))
		.orderBy(asc(providerConfig.createdAt));
	return rows.map(toView);
}

function validateSecret(input: ProviderConfigInput, existing: Row | undefined): void {
	const provider = getProvider(input.provider);
	const required = provider.fields
		.filter((f) => f.kind === 'secret' && f.required)
		.map((f) => f.name);
	if (input.secret === null) {
		if (
			required.length > 0 &&
			(!existing || existing.secretCiphertext === null || existing.provider !== input.provider)
		) {
			throw new RepositoryError(`${provider.name} needs ${required.join(' and ')}`, 400);
		}
		return;
	}
	const missing = required.filter((name) => !input.secret?.[name]);
	if (missing.length)
		throw new RepositoryError(`${provider.name} needs ${missing.join(' and ')}`, 400);
	const allowed = new Set(provider.fields.filter((f) => f.kind === 'secret').map((f) => f.name));
	for (const key of Object.keys(input.secret)) {
		if (!allowed.has(key)) throw new RepositoryError(`Unknown secret field: ${key}`, 400);
	}
}

export async function saveProvider(
	userId: string,
	input: ProviderConfigInput
): Promise<ProviderConfigView> {
	const saved = await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(providerConfig)
			.where(eq(providerConfig.id, input.id))
			.limit(1);
		if (existing && existing.userId !== userId) throw new RepositoryError('Not found', 404);
		validateSecret(input, existing);

		const allowedOptions = new Set(
			getProvider(input.provider)
				.fields.filter((f) => f.kind !== 'secret')
				.map((f) => f.name)
		);
		const options = Object.fromEntries(
			Object.entries(input.options).filter(([k]) => allowedOptions.has(k))
		);

		const [{ count } = { count: 0 }] = await tx
			.select({ count: sql<number>`count(*)::int` })
			.from(providerConfig)
			.where(eq(providerConfig.userId, userId));
		const isDefault = input.isDefault || count === 0 || (existing?.isDefault ?? false);
		if (isDefault) {
			await tx
				.update(providerConfig)
				.set({ isDefault: false })
				.where(eq(providerConfig.userId, userId));
		}

		const secretFields =
			input.secret !== null
				? {
						secretCiphertext: encryptSecret(JSON.stringify(input.secret), input.id),
						secretHint: secretHint(input.secret)
					}
				: existing && existing.provider === input.provider
					? {}
					: { secretCiphertext: null, secretHint: null };

		const values = {
			provider: input.provider,
			label: input.label,
			options,
			isDefault,
			updatedAt: new Date(),
			...secretFields
		};
		const [row] = await tx
			.insert(providerConfig)
			.values({ id: input.id, userId, ...values })
			.onConflictDoUpdate({
				target: providerConfig.id,
				set: values,
				setWhere: eq(providerConfig.userId, userId)
			})
			.returning();
		if (!row) throw new RepositoryError('Not found', 404);
		// Changing provider or options can change the data; drop the cache for this config.
		if (
			existing &&
			(existing.provider !== input.provider ||
				JSON.stringify(existing.options) !== JSON.stringify(options))
		) {
			await tx.delete(barCache).where(eq(barCache.providerConfigId, input.id));
			await tx.delete(barCoverage).where(eq(barCoverage.providerConfigId, input.id));
		}
		return row;
	});
	return toView(saved);
}

export async function removeProvider(userId: string, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		const [removed] = await tx
			.delete(providerConfig)
			.where(and(eq(providerConfig.id, id), eq(providerConfig.userId, userId)))
			.returning({ isDefault: providerConfig.isDefault });
		if (removed?.isDefault) {
			const [next] = await tx
				.select({ id: providerConfig.id })
				.from(providerConfig)
				.where(eq(providerConfig.userId, userId))
				.orderBy(asc(providerConfig.createdAt))
				.limit(1);
			if (next)
				await tx
					.update(providerConfig)
					.set({ isDefault: true })
					.where(eq(providerConfig.id, next.id));
		}
	});
}

async function resolveProvider(
	userId: string,
	id: string | null
): Promise<ResolvedProvider | null> {
	const where = id
		? and(eq(providerConfig.userId, userId), eq(providerConfig.id, id))
		: and(eq(providerConfig.userId, userId), eq(providerConfig.isDefault, true));
	const [row] = await db.select().from(providerConfig).where(where).limit(1);
	if (!row) return null;
	let secret: ProviderSecret = {};
	if (row.secretCiphertext) {
		const parsed = v.safeParse(
			ProviderSecretSchema,
			JSON.parse(decryptSecret(row.secretCiphertext, row.id))
		);
		if (!parsed.success)
			throw new RepositoryError('Stored provider secret is unreadable; save the key again', 500);
		secret = parsed.output;
	}
	return { config: toView(row), secret };
}

const cache: BarsCache = {
	async read(key, from, to) {
		const covered = await db
			.select({ id: barCoverage.id })
			.from(barCoverage)
			.where(
				and(
					eq(barCoverage.providerConfigId, key.provider),
					eq(barCoverage.instrument, key.instrument),
					eq(barCoverage.timeframe, key.timeframe),
					lte(barCoverage.fromMs, from),
					gte(barCoverage.toMs, to)
				)
			)
			.limit(1);
		if (!covered.length) return null;
		const rows = await db
			.select()
			.from(barCache)
			.where(
				and(
					eq(barCache.providerConfigId, key.provider),
					eq(barCache.instrument, key.instrument),
					eq(barCache.timeframe, key.timeframe),
					gte(barCache.time, Math.floor(from / 1000) - TIMEFRAME_SECONDS[key.timeframe]),
					lte(barCache.time, Math.ceil(to / 1000))
				)
			)
			.orderBy(asc(barCache.time));
		return rows.map((r) => ({
			time: r.time,
			open: r.open,
			high: r.high,
			low: r.low,
			close: r.close,
			volume: r.volume
		}));
	},
	async write(key, bars, from, to) {
		await db.transaction(async (tx) => {
			for (let i = 0; i < bars.length; i += 1000) {
				const chunk = bars.slice(i, i + 1000).map((b) => ({
					providerConfigId: key.provider,
					instrument: key.instrument,
					timeframe: key.timeframe,
					...b
				}));
				await tx
					.insert(barCache)
					.values(chunk)
					.onConflictDoUpdate({
						target: [
							barCache.providerConfigId,
							barCache.instrument,
							barCache.timeframe,
							barCache.time
						],
						set: {
							open: sql`excluded.open`,
							high: sql`excluded.high`,
							low: sql`excluded.low`,
							close: sql`excluded.close`,
							volume: sql`excluded.volume`
						}
					});
			}
			await tx.insert(barCoverage).values({
				providerConfigId: key.provider,
				instrument: key.instrument,
				timeframe: key.timeframe,
				fromMs: Math.floor(from),
				toMs: Math.ceil(to)
			});
		});
	}
};

export function barsService(userId: string, fetchImpl: typeof fetch) {
	return createBarsService({
		resolve: (id) => resolveProvider(userId, id),
		cache,
		fetch: fetchImpl
	});
}

export async function getBars(
	userId: string,
	request: BarsRequest,
	providerId: string | null,
	fetchImpl: typeof fetch
): Promise<BarsResult> {
	return barsService(userId, fetchImpl).get(request, providerId);
}

export async function testProvider(
	userId: string,
	id: string,
	fetchImpl: typeof fetch
): Promise<ProviderTestResult> {
	const resolved = await resolveProvider(userId, id);
	if (!resolved) throw new RepositoryError('Provider not found', 404);
	// The last full weekday session, a window every provider covers.
	const now = Date.now();
	const day = new Date(now - 86_400_000);
	while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
	const date = day.toISOString().slice(0, 10);
	const from = Date.parse(`${date}T13:30:00Z`) - 3 * 86_400_000;
	const to = Date.parse(`${date}T20:00:00Z`);
	const result = await createBarsService({ resolve: async () => resolved, fetch: fetchImpl }).get({
		instrument: { type: 'equity', symbol: 'SPY' },
		timeframe: '1h',
		from,
		to
	});
	if (result.status === 'ok') {
		return result.bars.length > 0
			? {
					ok: true,
					message: `Connected. Received ${result.bars.length} hourly SPY bars.`,
					bars: result.bars.length
				}
			: {
					ok: false,
					message: 'Connected, but the provider returned no SPY bars for the last session.',
					bars: 0
				};
	}
	if (result.status === 'no-provider') return { ok: false, message: 'Provider not found' };
	return { ok: false, message: result.message };
}
