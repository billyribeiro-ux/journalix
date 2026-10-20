/**
 * Pieces shared by the Tauri and browser repositories: schema validation that throws
 * `RepositoryError`, the provider connection test, and provider resolution for the bars service.
 */
import * as v from 'valibot';
import {
	ProviderSecretSchema,
	RepositoryError,
	type ProviderConfigView,
	type ProviderSecret,
	type ProviderTestResult
} from '@strikebook/core';
import {
	BarsRequestSchema,
	BarsResultSchema,
	createBarsService,
	type BarsCache,
	type BarsRequest,
	type BarsResult,
	type FetchLike,
	type ResolvedProvider
} from '@strikebook/core/market-data';

type AnySchema = v.GenericSchema;

function describeIssues(issues: readonly v.BaseIssue<unknown>[]): string[] {
	return issues.map((issue) => {
		const path = v.getDotPath(issue);
		return path ? `${path}: ${issue.message}` : issue.message;
	});
}

/**
 * Validates data before it crosses into storage. Invalid input is a caller error (400) and the
 * first issue becomes the message the UI shows.
 */
export function validateInput<S extends AnySchema>(
	schema: S,
	value: unknown,
	what: string
): v.InferOutput<S> {
	const result = v.safeParse(schema, value);
	if (result.success) return result.output;
	const issues = describeIssues(result.issues);
	throw new RepositoryError(`Invalid ${what}: ${issues[0] ?? 'unknown problem'}`, 400, issues);
}

/**
 * Validates data coming back from storage. A mismatch means the backend and the contract
 * disagree, which is a server-side failure (500), not something the user can fix.
 */
export function validateOutput<S extends AnySchema>(
	schema: S,
	value: unknown,
	what: string
): v.InferOutput<S> {
	const result = v.safeParse(schema, value);
	if (result.success) return result.output;
	const issues = describeIssues(result.issues);
	throw new RepositoryError(
		`Unexpected ${what} from storage: ${issues[0] ?? 'unknown problem'}`,
		500,
		issues
	);
}

/** `••••` plus the last four characters of `apiKey` (mirrors the Rust backend). */
export function secretHint(secret: ProviderSecret | null): string | null {
	const key = secret?.['apiKey'];
	if (!key) return null;
	const chars = [...key];
	return chars.length < 8 ? '••••' : `••••${chars.slice(-4).join('')}`;
}

export interface ProviderSource {
	list(): Promise<ProviderConfigView[]>;
	secret(id: string): Promise<ProviderSecret>;
}

/** Picks the requested provider, or the default one when `id` is null, and loads its secret. */
export function providerResolver(source: ProviderSource) {
	return async (id: string | null): Promise<ResolvedProvider | null> => {
		const providers = await source.list();
		const config =
			id === null ? providers.find((p) => p.isDefault) : providers.find((p) => p.id === id);
		if (!config) return null;
		// The simulator needs no credentials.
		const secret =
			config.provider === 'simulated'
				? {}
				: validateOutput(ProviderSecretSchema, await source.secret(config.id), 'provider secret');
		return { config, secret };
	};
}

export interface BarsApiDeps {
	readonly source: ProviderSource;
	readonly fetch: FetchLike;
	readonly cache: BarsCache;
}

const DAY_MS = 86_400_000;

/** `bars.get` and `providers.test` for a repository, built on the shared bars service. */
export function createBarsApi(deps: BarsApiDeps) {
	const resolve = providerResolver(deps.source);
	const cached = createBarsService({ resolve, fetch: deps.fetch, cache: deps.cache });
	// The connection test must reach the provider, so it never answers from the cache.
	const live = createBarsService({ resolve, fetch: deps.fetch });

	return {
		async get(request: BarsRequest, providerId: string | null = null): Promise<BarsResult> {
			const valid = validateInput(BarsRequestSchema, request, 'bars request');
			return validateOutput(BarsResultSchema, await cached.get(valid, providerId), 'bars result');
		},

		async test(id: string): Promise<ProviderTestResult> {
			const to = Date.now();
			const result = await live.get(
				{ instrument: { type: 'equity', symbol: 'SPY' }, timeframe: '1h', from: to - DAY_MS, to },
				id
			);
			switch (result.status) {
				case 'no-provider':
					return { ok: false, message: 'This provider is no longer configured' };
				case 'error':
					return { ok: false, message: result.message };
				case 'ok':
					return {
						ok: true,
						message:
							result.bars.length > 0
								? `Connected to ${result.provider.label}: received ${result.bars.length} hourly SPY bars`
								: `Connected to ${result.provider.label}; no SPY bars in the last 24 hours (market closed)`,
						bars: result.bars.length
					};
			}
		}
	};
}
