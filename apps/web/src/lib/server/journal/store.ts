/**
 * Server-side journal repository. Every query is scoped to the signed-in user; ownership of
 * referenced rows (accounts, playbooks, tags) is checked before writes so one user can never
 * attach data to another user's records.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import * as v from 'valibot';
import {
	DEFAULT_SETTINGS,
	RepositoryError,
	UserSettingsSchema,
	type Account,
	type Execution,
	type JournalExport,
	type Leg,
	type Note,
	type Playbook,
	type PriceLevel,
	type StrategyKind,
	type Tag,
	type Trade,
	type UserSettings
} from '@strikebook/core';
import { db, type Transaction } from '../db/index.ts';
import {
	note,
	playbook,
	tag,
	trade,
	tradeExecution,
	tradeLeg,
	tradeLevel,
	tradeTag,
	tradingAccount,
	userSettings
} from '../db/schema.ts';

type Db = typeof db | Transaction;

const iso = (d: Date): string => d.toISOString();

// ---------- Accounts ----------

export async function listAccounts(userId: string): Promise<Account[]> {
	const rows = await db
		.select()
		.from(tradingAccount)
		.where(eq(tradingAccount.userId, userId))
		.orderBy(asc(tradingAccount.createdAt));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		broker: r.broker,
		currency: r.currency,
		startingBalance: r.startingBalance,
		archived: r.archived,
		createdAt: iso(r.createdAt)
	}));
}

async function assertNotOwnedByOther(
	tx: Db,
	table: typeof tradingAccount | typeof tag | typeof playbook | typeof note,
	id: string,
	userId: string
): Promise<void> {
	const [row] = await tx
		.select({ userId: table.userId })
		.from(table)
		.where(eq(table.id, id))
		.limit(1);
	if (row && row.userId !== userId) throw new RepositoryError('Not found', 404);
}

export async function saveAccount(userId: string, a: Account): Promise<Account> {
	await db.transaction(async (tx) => {
		await assertNotOwnedByOther(tx, tradingAccount, a.id, userId);
		const values = {
			name: a.name,
			broker: a.broker,
			currency: a.currency,
			startingBalance: a.startingBalance,
			archived: a.archived
		};
		const [owned] = await tx
			.insert(tradingAccount)
			.values({ id: a.id, userId, createdAt: new Date(a.createdAt), ...values })
			// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
			.onConflictDoUpdate({
				target: tradingAccount.id,
				set: values,
				setWhere: eq(tradingAccount.userId, userId)
			})
			.returning({ id: tradingAccount.id });
		if (!owned) throw new RepositoryError('Not found', 404);
	});
	return a;
}

export async function removeAccount(userId: string, id: string): Promise<void> {
	await db
		.delete(tradingAccount)
		.where(and(eq(tradingAccount.id, id), eq(tradingAccount.userId, userId)));
}

// ---------- Tags ----------

export async function listTags(userId: string): Promise<Tag[]> {
	const rows = await db
		.select()
		.from(tag)
		.where(eq(tag.userId, userId))
		.orderBy(asc(tag.category), asc(tag.name));
	return rows.map((r) => ({ id: r.id, name: r.name, category: r.category, color: r.color }));
}

export async function saveTag(userId: string, t: Tag): Promise<Tag> {
	await db.transaction(async (tx) => {
		await assertNotOwnedByOther(tx, tag, t.id, userId);
		const values = { name: t.name, category: t.category, color: t.color };
		const [owned] = await tx
			.insert(tag)
			.values({ id: t.id, userId, ...values })
			// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
			.onConflictDoUpdate({ target: tag.id, set: values, setWhere: eq(tag.userId, userId) })
			.returning({ id: tag.id });
		if (!owned) throw new RepositoryError('Not found', 404);
	});
	return t;
}

export async function removeTag(userId: string, id: string): Promise<void> {
	await db.delete(tag).where(and(eq(tag.id, id), eq(tag.userId, userId)));
}

// ---------- Playbooks ----------

export async function listPlaybooks(userId: string): Promise<Playbook[]> {
	const rows = await db
		.select()
		.from(playbook)
		.where(eq(playbook.userId, userId))
		.orderBy(asc(playbook.createdAt));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		description: r.description,
		rules: r.rules,
		color: r.color,
		archived: r.archived,
		createdAt: iso(r.createdAt)
	}));
}

export async function savePlaybook(userId: string, p: Playbook): Promise<Playbook> {
	await db.transaction(async (tx) => {
		await assertNotOwnedByOther(tx, playbook, p.id, userId);
		const values = {
			name: p.name,
			description: p.description,
			rules: p.rules,
			color: p.color,
			archived: p.archived
		};
		const [owned] = await tx
			.insert(playbook)
			.values({ id: p.id, userId, createdAt: new Date(p.createdAt), ...values })
			// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
			.onConflictDoUpdate({
				target: playbook.id,
				set: values,
				setWhere: eq(playbook.userId, userId)
			})
			.returning({ id: playbook.id });
		if (!owned) throw new RepositoryError('Not found', 404);
	});
	return p;
}

export async function removePlaybook(userId: string, id: string): Promise<void> {
	await db.delete(playbook).where(and(eq(playbook.id, id), eq(playbook.userId, userId)));
}

// ---------- Notes ----------

export async function listNotes(userId: string): Promise<Note[]> {
	const rows = await db
		.select()
		.from(note)
		.where(eq(note.userId, userId))
		.orderBy(asc(note.date), asc(note.createdAt));
	return rows.map((r) => ({
		id: r.id,
		date: r.date,
		title: r.title,
		body: r.body,
		kind: r.kind,
		createdAt: iso(r.createdAt),
		updatedAt: iso(r.updatedAt)
	}));
}

export async function saveNote(userId: string, n: Note): Promise<Note> {
	await db.transaction(async (tx) => {
		await assertNotOwnedByOther(tx, note, n.id, userId);
		const values = {
			date: n.date,
			title: n.title,
			body: n.body,
			kind: n.kind,
			updatedAt: new Date(n.updatedAt)
		};
		const [owned] = await tx
			.insert(note)
			.values({ id: n.id, userId, createdAt: new Date(n.createdAt), ...values })
			// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
			.onConflictDoUpdate({ target: note.id, set: values, setWhere: eq(note.userId, userId) })
			.returning({ id: note.id });
		if (!owned) throw new RepositoryError('Not found', 404);
	});
	return n;
}

export async function removeNote(userId: string, id: string): Promise<void> {
	await db.delete(note).where(and(eq(note.id, id), eq(note.userId, userId)));
}

// ---------- Settings ----------

export async function getSettings(userId: string): Promise<UserSettings> {
	const [row] = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.limit(1);
	if (!row) return DEFAULT_SETTINGS;
	// Merge over defaults so settings added in later versions get sensible values.
	const parsed = v.safeParse(UserSettingsSchema, {
		...DEFAULT_SETTINGS,
		...(row.settings as object)
	});
	return parsed.success ? parsed.output : DEFAULT_SETTINGS;
}

export async function saveSettings(userId: string, s: UserSettings): Promise<UserSettings> {
	await db
		.insert(userSettings)
		.values({ userId, settings: s, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: userSettings.userId,
			set: { settings: s, updatedAt: new Date() }
		});
	return s;
}

// ---------- Trades ----------

async function loadTrades(userId: string, ids: string[] | null): Promise<Trade[]> {
	const where =
		ids === null ? eq(trade.userId, userId) : and(eq(trade.userId, userId), inArray(trade.id, ids));
	const rows = await db.select().from(trade).where(where).orderBy(asc(trade.createdAt));
	if (rows.length === 0) return [];
	const tradeIds = rows.map((r) => r.id);
	const [legs, executions, levels, tags] = await Promise.all([
		db
			.select()
			.from(tradeLeg)
			.where(inArray(tradeLeg.tradeId, tradeIds))
			.orderBy(asc(tradeLeg.position)),
		db
			.select()
			.from(tradeExecution)
			.where(inArray(tradeExecution.tradeId, tradeIds))
			.orderBy(asc(tradeExecution.executedAt)),
		db
			.select()
			.from(tradeLevel)
			.where(inArray(tradeLevel.tradeId, tradeIds))
			.orderBy(asc(tradeLevel.setAt)),
		db.select().from(tradeTag).where(inArray(tradeTag.tradeId, tradeIds))
	]);

	const group = <T extends { tradeId: string }>(items: readonly T[]): Map<string, T[]> => {
		const map = new Map<string, T[]>();
		for (const item of items) {
			const list = map.get(item.tradeId);
			if (list) list.push(item);
			else map.set(item.tradeId, [item]);
		}
		return map;
	};
	const legsBy = group(legs);
	const execBy = group(executions);
	const levelsBy = group(levels);
	const tagsBy = group(tags);

	return rows.map((r): Trade => ({
		id: r.id,
		accountId: r.accountId,
		underlying: r.underlying,
		assetClass: r.assetClass,
		strategy: (r.strategy as StrategyKind | null) ?? null,
		playbookId: r.playbookId,
		tagIds: (tagsBy.get(r.id) ?? []).map((t) => t.tagId),
		legs: (legsBy.get(r.id) ?? []).map((l): Leg => ({
			id: l.id,
			kind: l.kind,
			underlying: l.underlying,
			strike: l.strike,
			expiration: l.expiration,
			multiplier: l.multiplier
		})),
		executions: (execBy.get(r.id) ?? []).map((e): Execution => ({
			id: e.id,
			legId: e.legId,
			side: e.side,
			kind: e.kind,
			quantity: e.quantity,
			price: e.price,
			fees: e.fees,
			executedAt: iso(e.executedAt),
			underlyingPrice: e.underlyingPrice,
			note: e.note
		})),
		levels: (levelsBy.get(r.id) ?? []).map((l): PriceLevel => ({
			id: l.id,
			kind: l.kind,
			price: l.price,
			setAt: iso(l.setAt),
			note: l.note
		})),
		plannedRisk: r.plannedRisk,
		thesis: r.thesis,
		review: r.review,
		rating: r.rating,
		confidence: r.confidence,
		mfe: r.mfe,
		mae: r.mae,
		createdAt: iso(r.createdAt),
		updatedAt: iso(r.updatedAt)
	}));
}

export function listTrades(userId: string): Promise<Trade[]> {
	return loadTrades(userId, null);
}

export async function getTrade(userId: string, id: string): Promise<Trade | null> {
	const [t] = await loadTrades(userId, [id]);
	return t ?? null;
}

async function assertReferences(tx: Db, userId: string, t: Trade): Promise<void> {
	const [account] = await tx
		.select({ id: tradingAccount.id })
		.from(tradingAccount)
		.where(and(eq(tradingAccount.id, t.accountId), eq(tradingAccount.userId, userId)))
		.limit(1);
	if (!account) throw new RepositoryError('Account not found', 400);
	if (t.playbookId) {
		const [p] = await tx
			.select({ id: playbook.id })
			.from(playbook)
			.where(and(eq(playbook.id, t.playbookId), eq(playbook.userId, userId)))
			.limit(1);
		if (!p) throw new RepositoryError('Playbook not found', 400);
	}
	if (t.tagIds.length) {
		const owned = await tx
			.select({ id: tag.id })
			.from(tag)
			.where(and(eq(tag.userId, userId), inArray(tag.id, [...t.tagIds])));
		if (owned.length !== new Set(t.tagIds).size) throw new RepositoryError('Tag not found', 400);
	}
}

async function writeTrade(tx: Db, userId: string, t: Trade): Promise<void> {
	const [existing] = await tx
		.select({ userId: trade.userId })
		.from(trade)
		.where(eq(trade.id, t.id))
		.limit(1);
	if (existing && existing.userId !== userId) throw new RepositoryError('Not found', 404);
	await assertReferences(tx, userId, t);

	const values = {
		accountId: t.accountId,
		underlying: t.underlying,
		assetClass: t.assetClass,
		strategy: t.strategy,
		playbookId: t.playbookId,
		plannedRisk: t.plannedRisk,
		thesis: t.thesis,
		review: t.review,
		rating: t.rating,
		confidence: t.confidence,
		mfe: t.mfe,
		mae: t.mae,
		updatedAt: new Date(t.updatedAt)
	};
	const [owned] = await tx
		.insert(trade)
		.values({ id: t.id, userId, createdAt: new Date(t.createdAt), ...values })
		// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
		.onConflictDoUpdate({ target: trade.id, set: values, setWhere: eq(trade.userId, userId) })
		.returning({ id: trade.id });
	if (!owned) throw new RepositoryError('Not found', 404);

	// Children are replaced wholesale: the aggregate is the unit of consistency.
	await tx.delete(tradeLeg).where(eq(tradeLeg.tradeId, t.id));
	await tx.delete(tradeLevel).where(eq(tradeLevel.tradeId, t.id));
	await tx.delete(tradeTag).where(eq(tradeTag.tradeId, t.id));

	if (t.legs.length) {
		await tx.insert(tradeLeg).values(
			t.legs.map((l, position) => ({
				id: l.id,
				tradeId: t.id,
				position,
				kind: l.kind,
				underlying: l.underlying,
				strike: l.strike,
				expiration: l.expiration,
				multiplier: l.multiplier
			}))
		);
	}
	if (t.executions.length) {
		await tx.insert(tradeExecution).values(
			t.executions.map((e) => ({
				id: e.id,
				tradeId: t.id,
				legId: e.legId,
				side: e.side,
				kind: e.kind,
				quantity: e.quantity,
				price: e.price,
				fees: e.fees,
				executedAt: new Date(e.executedAt),
				underlyingPrice: e.underlyingPrice,
				note: e.note
			}))
		);
	}
	if (t.levels.length) {
		await tx.insert(tradeLevel).values(
			t.levels.map((l) => ({
				id: l.id,
				tradeId: t.id,
				kind: l.kind,
				price: l.price,
				setAt: new Date(l.setAt),
				note: l.note
			}))
		);
	}
	if (t.tagIds.length) {
		await tx
			.insert(tradeTag)
			.values([...new Set(t.tagIds)].map((tagId) => ({ tradeId: t.id, tagId })));
	}
}

export async function saveTrade(userId: string, t: Trade): Promise<Trade> {
	await db.transaction((tx) => writeTrade(tx, userId, t));
	const saved = await getTrade(userId, t.id);
	if (!saved) throw new RepositoryError('Trade was not saved', 500);
	return saved;
}

export async function removeTrade(userId: string, id: string): Promise<void> {
	await db.delete(trade).where(and(eq(trade.id, id), eq(trade.userId, userId)));
}

// ---------- Import / export ----------

export async function exportJournal(userId: string): Promise<JournalExport> {
	const [settings, accounts, tags, playbooks, notes, trades] = await Promise.all([
		getSettings(userId),
		listAccounts(userId),
		listTags(userId),
		listPlaybooks(userId),
		listNotes(userId),
		listTrades(userId)
	]);
	return {
		format: 'strikebook.journal',
		version: 1,
		exportedAt: new Date().toISOString(),
		settings,
		accounts,
		tags,
		playbooks,
		notes,
		trades
	};
}

export async function importJournal(
	userId: string,
	data: JournalExport
): Promise<{ trades: number }> {
	await db.transaction(async (tx) => {
		// Refuse ids that belong to another user, for every entity in the file.
		const check = async (
			table: typeof tradingAccount | typeof tag | typeof playbook | typeof note | typeof trade,
			ids: string[]
		) => {
			if (!ids.length) return;
			const foreign = await tx
				.select({ id: table.id })
				.from(table)
				.where(and(inArray(table.id, ids), sql`${table.userId} <> ${userId}`))
				.limit(1);
			if (foreign.length)
				throw new RepositoryError('The file contains records owned by another account', 409);
		};
		await check(
			tradingAccount,
			data.accounts.map((a) => a.id)
		);
		await check(
			tag,
			data.tags.map((t) => t.id)
		);
		await check(
			playbook,
			data.playbooks.map((p) => p.id)
		);
		await check(
			note,
			data.notes.map((n) => n.id)
		);
		await check(
			trade,
			data.trades.map((t) => t.id)
		);

		await tx
			.insert(userSettings)
			.values({ userId, settings: data.settings, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: userSettings.userId,
				set: { settings: data.settings, updatedAt: new Date() }
			});
		for (const a of data.accounts) {
			const values = {
				name: a.name,
				broker: a.broker,
				currency: a.currency,
				startingBalance: a.startingBalance,
				archived: a.archived
			};
			const [owned] = await tx
				.insert(tradingAccount)
				.values({ id: a.id, userId, createdAt: new Date(a.createdAt), ...values })
				// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
				.onConflictDoUpdate({
					target: tradingAccount.id,
					set: values,
					setWhere: eq(tradingAccount.userId, userId)
				})
				.returning({ id: tradingAccount.id });
			if (!owned) throw new RepositoryError('Not found', 404);
		}
		for (const t of data.tags) {
			const values = { name: t.name, category: t.category, color: t.color };
			const [owned] = await tx
				.insert(tag)
				.values({ id: t.id, userId, ...values })
				// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
				.onConflictDoUpdate({ target: tag.id, set: values, setWhere: eq(tag.userId, userId) })
				.returning({ id: tag.id });
			if (!owned) throw new RepositoryError('Not found', 404);
		}
		for (const p of data.playbooks) {
			const values = {
				name: p.name,
				description: p.description,
				rules: p.rules,
				color: p.color,
				archived: p.archived
			};
			const [owned] = await tx
				.insert(playbook)
				.values({ id: p.id, userId, createdAt: new Date(p.createdAt), ...values })
				// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
				.onConflictDoUpdate({
					target: playbook.id,
					set: values,
					setWhere: eq(playbook.userId, userId)
				})
				.returning({ id: playbook.id });
			if (!owned) throw new RepositoryError('Not found', 404);
		}
		for (const n of data.notes) {
			const values = {
				date: n.date,
				title: n.title,
				body: n.body,
				kind: n.kind,
				updatedAt: new Date(n.updatedAt)
			};
			const [owned] = await tx
				.insert(note)
				.values({ id: n.id, userId, createdAt: new Date(n.createdAt), ...values })
				// The WHERE makes a conflicting id that belongs to another user a no-op, never an overwrite.
				.onConflictDoUpdate({ target: note.id, set: values, setWhere: eq(note.userId, userId) })
				.returning({ id: note.id });
			if (!owned) throw new RepositoryError('Not found', 404);
		}
		for (const t of data.trades) await writeTrade(tx, userId, t);
	});
	return { trades: data.trades.length };
}

export async function resetJournal(userId: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(trade).where(eq(trade.userId, userId));
		await tx.delete(note).where(eq(note.userId, userId));
		await tx.delete(playbook).where(eq(playbook.userId, userId));
		await tx.delete(tag).where(eq(tag.userId, userId));
		await tx.delete(tradingAccount).where(eq(tradingAccount.userId, userId));
	});
}
