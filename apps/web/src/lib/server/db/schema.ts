/**
 * Journal tables. Every row belongs to a Better Auth user and is deleted with them.
 * Trades are stored normalised (legs, executions, levels, tags) and saved as one aggregate
 * inside a transaction, so a trade is never partially written.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	doublePrecision,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uuid,
	bigint,
	date
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema.ts';

const owner = () =>
	text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const money = (name: string) => numeric(name, { precision: 20, scale: 6, mode: 'number' });
const price = (name: string) => numeric(name, { precision: 20, scale: 8, mode: 'number' });

export const assetClass = pgEnum('asset_class', ['stock', 'option', 'future', 'crypto', 'forex']);
export const legKind = pgEnum('leg_kind', ['stock', 'call', 'put', 'future', 'crypto', 'forex']);
export const side = pgEnum('side', ['buy', 'sell']);
export const executionKind = pgEnum('execution_kind', [
	'fill',
	'expiration',
	'assignment',
	'exercise'
]);
export const levelKind = pgEnum('level_kind', ['stop', 'target']);
export const tagCategory = pgEnum('tag_category', [
	'setup',
	'mistake',
	'emotion',
	'market',
	'custom'
]);
export const noteKind = pgEnum('note_kind', ['premarket', 'recap', 'lesson', 'general']);
export const providerKind = pgEnum('provider_kind', [
	'massive',
	'alpaca',
	'tiingo',
	'databento',
	'simulated'
]);

export const tradingAccount = pgTable(
	'trading_account',
	{
		id: uuid('id').primaryKey(),
		userId: owner(),
		name: text('name').notNull(),
		broker: text('broker').notNull().default(''),
		currency: text('currency').notNull().default('USD'),
		startingBalance: money('starting_balance').notNull().default(0),
		archived: boolean('archived').notNull().default(false),
		createdAt: ts('created_at').notNull().defaultNow()
	},
	(t) => [index('trading_account_user_idx').on(t.userId)]
);

export const tag = pgTable(
	'tag',
	{
		id: uuid('id').primaryKey(),
		userId: owner(),
		name: text('name').notNull(),
		category: tagCategory('category').notNull(),
		color: text('color').notNull()
	},
	(t) => [index('tag_user_idx').on(t.userId)]
);

export const playbook = pgTable(
	'playbook',
	{
		id: uuid('id').primaryKey(),
		userId: owner(),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		rules: jsonb('rules').$type<string[]>().notNull().default([]),
		color: text('color').notNull(),
		archived: boolean('archived').notNull().default(false),
		createdAt: ts('created_at').notNull().defaultNow()
	},
	(t) => [index('playbook_user_idx').on(t.userId)]
);

export const trade = pgTable(
	'trade',
	{
		id: uuid('id').primaryKey(),
		userId: owner(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => tradingAccount.id, { onDelete: 'cascade' }),
		underlying: text('underlying').notNull(),
		assetClass: assetClass('asset_class').notNull(),
		strategy: text('strategy'),
		playbookId: uuid('playbook_id').references(() => playbook.id, { onDelete: 'set null' }),
		plannedRisk: money('planned_risk'),
		thesis: text('thesis').notNull().default(''),
		review: text('review').notNull().default(''),
		rating: smallint('rating'),
		confidence: smallint('confidence'),
		mfe: money('mfe'),
		mae: money('mae'),
		createdAt: ts('created_at').notNull(),
		updatedAt: ts('updated_at').notNull()
	},
	(t) => [
		index('trade_user_idx').on(t.userId),
		index('trade_account_idx').on(t.accountId),
		index('trade_user_underlying_idx').on(t.userId, t.underlying),
		check('trade_rating_range', sql`${t.rating} is null or ${t.rating} between 1 and 5`),
		check('trade_confidence_range', sql`${t.confidence} is null or ${t.confidence} between 1 and 5`)
	]
);

export const tradeLeg = pgTable(
	'trade_leg',
	{
		id: uuid('id').primaryKey(),
		tradeId: uuid('trade_id')
			.notNull()
			.references(() => trade.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		kind: legKind('kind').notNull(),
		underlying: text('underlying').notNull(),
		strike: price('strike'),
		expiration: date('expiration', { mode: 'string' }),
		multiplier: doublePrecision('multiplier').notNull()
	},
	(t) => [index('trade_leg_trade_idx').on(t.tradeId)]
);

export const tradeExecution = pgTable(
	'trade_execution',
	{
		id: uuid('id').primaryKey(),
		tradeId: uuid('trade_id')
			.notNull()
			.references(() => trade.id, { onDelete: 'cascade' }),
		legId: uuid('leg_id')
			.notNull()
			.references(() => tradeLeg.id, { onDelete: 'cascade' }),
		side: side('side').notNull(),
		kind: executionKind('kind').notNull(),
		quantity: price('quantity').notNull(),
		price: price('price').notNull(),
		fees: money('fees').notNull().default(0),
		executedAt: ts('executed_at').notNull(),
		underlyingPrice: price('underlying_price'),
		note: text('note').notNull().default('')
	},
	(t) => [
		index('trade_execution_trade_idx').on(t.tradeId),
		check('trade_execution_quantity_positive', sql`${t.quantity} > 0`),
		check('trade_execution_price_nonnegative', sql`${t.price} >= 0`)
	]
);

export const tradeLevel = pgTable(
	'trade_level',
	{
		id: uuid('id').primaryKey(),
		tradeId: uuid('trade_id')
			.notNull()
			.references(() => trade.id, { onDelete: 'cascade' }),
		kind: levelKind('kind').notNull(),
		price: price('price').notNull(),
		setAt: ts('set_at').notNull(),
		note: text('note').notNull().default('')
	},
	(t) => [index('trade_level_trade_idx').on(t.tradeId)]
);

export const tradeTag = pgTable(
	'trade_tag',
	{
		tradeId: uuid('trade_id')
			.notNull()
			.references(() => trade.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.tradeId, t.tagId] }), index('trade_tag_tag_idx').on(t.tagId)]
);

export const note = pgTable(
	'note',
	{
		id: uuid('id').primaryKey(),
		userId: owner(),
		date: date('date', { mode: 'string' }).notNull(),
		title: text('title').notNull().default(''),
		body: text('body').notNull().default(''),
		kind: noteKind('kind').notNull(),
		createdAt: ts('created_at').notNull(),
		updatedAt: ts('updated_at').notNull()
	},
	(t) => [index('note_user_date_idx').on(t.userId, t.date)]
);

export const userSettings = pgTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	settings: jsonb('settings').notNull(),
	updatedAt: ts('updated_at').notNull().defaultNow()
});

export const providerConfig = pgTable(
	'provider_config',
	{
		id: uuid('id').primaryKey(),
		userId: owner(),
		provider: providerKind('provider').notNull(),
		label: text('label').notNull(),
		options: jsonb('options').$type<Record<string, string>>().notNull().default({}),
		isDefault: boolean('is_default').notNull().default(false),
		/** AES-256-GCM ciphertext of the JSON secret: base64(iv ‖ tag ‖ ciphertext). */
		secretCiphertext: text('secret_ciphertext'),
		secretHint: text('secret_hint'),
		createdAt: ts('created_at').notNull().defaultNow(),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [index('provider_config_user_idx').on(t.userId)]
);

/** Cached bars, shared per provider configuration. */
export const barCache = pgTable(
	'bar_cache',
	{
		providerConfigId: uuid('provider_config_id')
			.notNull()
			.references(() => providerConfig.id, { onDelete: 'cascade' }),
		instrument: text('instrument').notNull(),
		timeframe: text('timeframe').notNull(),
		time: bigint('time', { mode: 'number' }).notNull(),
		open: doublePrecision('open').notNull(),
		high: doublePrecision('high').notNull(),
		low: doublePrecision('low').notNull(),
		close: doublePrecision('close').notNull(),
		volume: doublePrecision('volume').notNull()
	},
	(t) => [primaryKey({ columns: [t.providerConfigId, t.instrument, t.timeframe, t.time] })]
);

/** Windows already fetched, so a fully covered request never hits the provider again. */
export const barCoverage = pgTable(
	'bar_coverage',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		providerConfigId: uuid('provider_config_id')
			.notNull()
			.references(() => providerConfig.id, { onDelete: 'cascade' }),
		instrument: text('instrument').notNull(),
		timeframe: text('timeframe').notNull(),
		fromMs: bigint('from_ms', { mode: 'number' }).notNull(),
		toMs: bigint('to_ms', { mode: 'number' }).notNull()
	},
	(t) => [index('bar_coverage_lookup_idx').on(t.providerConfigId, t.instrument, t.timeframe)]
);

export const contactMessage = pgTable('contact_message', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	topic: text('topic').notNull(),
	message: text('message').notNull(),
	createdAt: ts('created_at').notNull().defaultNow()
});

export * from './auth.schema.ts';
