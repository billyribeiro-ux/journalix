import { describe, expect, it } from 'vitest';
import { newId, RepositoryError, type Account, type Trade } from '@strikebook/core';
import { createBrowserRepository } from './browser-repository.ts';

const T0 = '2026-10-20T13:30:00.000Z';

function account(): Account {
	return {
		id: newId(),
		name: ' Margin ',
		broker: 'Schwab',
		currency: 'usd',
		startingBalance: 25_000,
		archived: false,
		createdAt: T0
	};
}

function trade(accountId: string, tagIds: string[] = []): Trade {
	const legId = newId();
	return {
		id: newId(),
		accountId,
		underlying: 'SPY',
		assetClass: 'option',
		strategy: null,
		playbookId: null,
		tagIds,
		legs: [
			{
				id: legId,
				kind: 'call',
				underlying: 'SPY',
				strike: 580,
				expiration: '2026-11-20',
				multiplier: 100
			}
		],
		executions: [
			{
				id: newId(),
				legId,
				side: 'buy',
				kind: 'fill',
				quantity: 1,
				price: 6.4,
				fees: 0.65,
				executedAt: T0,
				underlyingPrice: 580.25,
				note: ''
			}
		],
		levels: [],
		plannedRisk: null,
		thesis: '',
		review: '',
		rating: null,
		confidence: null,
		mfe: null,
		mae: null,
		createdAt: T0,
		updatedAt: T0
	};
}

// Node has no usable localStorage here, so the repository runs on its in-memory fallback.
describe('browser repository (development fallback)', () => {
	it('validates and normalises entities', async () => {
		const repo = createBrowserRepository();
		const saved = await repo.accounts.save(account());
		expect(saved.name).toBe('Margin');
		expect(saved.currency).toBe('USD');
		await expect(repo.accounts.save({ ...account(), name: '   ' })).rejects.toBeInstanceOf(
			RepositoryError
		);
	});

	it('enforces references and cascades like the SQLite backend', async () => {
		const repo = createBrowserRepository();
		const acct = await repo.accounts.save(account());
		const tag = await repo.tags.save({
			id: newId(),
			name: 'Breakout',
			category: 'setup',
			color: '#f2c14e'
		});

		await expect(repo.trades.save(trade(newId()))).rejects.toMatchObject({ status: 409 });

		const saved = await repo.trades.save(trade(acct.id, [tag.id]));
		expect(await repo.trades.get(saved.id)).toEqual(saved);

		await repo.tags.remove(tag.id);
		expect((await repo.trades.get(saved.id))?.tagIds).toEqual([]);

		await repo.accounts.remove(acct.id);
		expect(await repo.trades.list()).toEqual([]);
	});

	it('keeps exactly one default provider and never lists secrets', async () => {
		const repo = createBrowserRepository();
		const a = await repo.providers.save({
			id: newId(),
			provider: 'massive',
			label: 'Massive',
			options: {},
			isDefault: false,
			secret: { apiKey: 'abcd1234WXYZ' }
		});
		expect(a.isDefault).toBe(true);
		expect(a.secretHint).toBe('••••WXYZ');

		const b = await repo.providers.save({
			id: newId(),
			provider: 'simulated',
			label: 'Demo',
			options: {},
			isDefault: true,
			secret: null
		});
		const list = await repo.providers.list();
		expect(list.filter((p) => p.isDefault).map((p) => p.id)).toEqual([b.id]);
		expect(JSON.stringify(list)).not.toContain('abcd1234WXYZ');

		await repo.providers.remove(b.id);
		expect((await repo.providers.list()).map((p) => p.isDefault)).toEqual([true]);
	});

	it('serves simulated bars and reports a missing provider', async () => {
		const repo = createBrowserRepository();
		const to = Date.parse('2026-10-16T20:00:00Z');
		const request = {
			instrument: { type: 'equity', symbol: 'SPY' },
			timeframe: '1h',
			from: to - 3 * 86_400_000,
			to
		} as const;
		expect(await repo.bars.get(request)).toEqual({ status: 'no-provider' });

		await repo.providers.save({
			id: newId(),
			provider: 'simulated',
			label: 'Demo',
			options: {},
			isDefault: true,
			secret: null
		});
		const result = await repo.bars.get(request);
		expect(result.status).toBe('ok');
		if (result.status === 'ok') expect(result.bars.length).toBeGreaterThan(0);

		await expect(repo.bars.get({ ...request, to: request.from })).rejects.toBeInstanceOf(
			RepositoryError
		);
	});

	it('round-trips export and import, and reset keeps providers', async () => {
		const repo = createBrowserRepository();
		const acct = await repo.accounts.save(account());
		await repo.trades.save(trade(acct.id));
		await repo.providers.save({
			id: newId(),
			provider: 'simulated',
			label: 'Demo',
			options: {},
			isDefault: true,
			secret: null
		});
		const exported = await repo.data.exportAll();

		await repo.data.reset();
		expect(await repo.trades.list()).toEqual([]);
		expect(await repo.providers.list()).toHaveLength(1);

		expect(await repo.data.importAll(exported)).toEqual({ trades: 1 });
		expect(await repo.trades.list()).toEqual(exported.trades);
	});
});
