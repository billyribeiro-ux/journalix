/**
 * Single source of truth for the journal's data model.
 *
 * Every persisted shape is declared once as a Valibot schema. TypeScript types are
 * inferred from these schemas, and the same schemas validate input at every trust
 * boundary (HTTP handlers on the web, Tauri commands on the desktop, and imports).
 */
import * as v from 'valibot';

const MAX_TEXT = 20_000;
const MAX_NAME = 120;

export const IdSchema = v.pipe(v.string(), v.uuid('Invalid id'));

/** ISO-8601 instant with an explicit offset or `Z`, e.g. `2026-10-20T13:30:00.000Z`. */
export const IsoDateTimeSchema = v.pipe(
	v.string(),
	v.isoTimestamp('Expected an ISO-8601 timestamp')
);

/** Calendar date, `YYYY-MM-DD`. */
export const IsoDateSchema = v.pipe(v.string(), v.isoDate('Expected a YYYY-MM-DD date'));

const FiniteNumber = v.pipe(v.number(), v.finite());
const NonNegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const Positive = v.pipe(v.number(), v.finite(), v.gtValue(0));

export const SymbolSchema = v.pipe(
	v.string(),
	v.trim(),
	v.toUpperCase(),
	v.minLength(1, 'Symbol is required'),
	v.maxLength(32),
	v.regex(/^[A-Z0-9./:^_-]+$/, 'Symbol contains invalid characters')
);

export const AssetClassSchema = v.picklist(['stock', 'option', 'future', 'crypto', 'forex']);
export type AssetClass = v.InferOutput<typeof AssetClassSchema>;

export const LegKindSchema = v.picklist(['stock', 'call', 'put', 'future', 'crypto', 'forex']);
export type LegKind = v.InferOutput<typeof LegKindSchema>;

export const SideSchema = v.picklist(['buy', 'sell']);
export type Side = v.InferOutput<typeof SideSchema>;

/**
 * How an execution came about. `expiration` closes an option leg at zero;
 * `assignment` / `exercise` close the option leg and are paired with a stock execution.
 */
export const ExecutionKindSchema = v.picklist(['fill', 'expiration', 'assignment', 'exercise']);
export type ExecutionKind = v.InferOutput<typeof ExecutionKindSchema>;

export const StrategyKindSchema = v.picklist([
	'shares_long',
	'shares_short',
	'long_call',
	'short_call',
	'long_put',
	'short_put',
	'covered_call',
	'protective_put',
	'collar',
	'bull_call_spread',
	'bear_call_spread',
	'bull_put_spread',
	'bear_put_spread',
	'long_straddle',
	'short_straddle',
	'long_strangle',
	'short_strangle',
	'iron_condor',
	'reverse_iron_condor',
	'iron_butterfly',
	'reverse_iron_butterfly',
	'long_call_butterfly',
	'short_call_butterfly',
	'long_put_butterfly',
	'short_put_butterfly',
	'call_calendar',
	'put_calendar',
	'call_diagonal',
	'put_diagonal',
	'ratio_spread',
	'futures_long',
	'futures_short',
	'custom'
]);
export type StrategyKind = v.InferOutput<typeof StrategyKindSchema>;

export const LegSchema = v.pipe(
	v.object({
		id: IdSchema,
		kind: LegKindSchema,
		/** Underlying ticker for every leg kind (the stock itself for stock legs). */
		underlying: SymbolSchema,
		strike: v.nullable(Positive),
		expiration: v.nullable(IsoDateSchema),
		/** Contract multiplier: 100 for standard equity options, 1 for shares. */
		multiplier: Positive
	}),
	v.check(
		(leg) =>
			leg.kind === 'call' || leg.kind === 'put'
				? leg.strike !== null && leg.expiration !== null
				: leg.strike === null,
		'Option legs need a strike and an expiration; other legs must not have a strike'
	)
);
export type Leg = v.InferOutput<typeof LegSchema>;

export const ExecutionSchema = v.object({
	id: IdSchema,
	legId: IdSchema,
	side: SideSchema,
	kind: ExecutionKindSchema,
	/** Shares or contracts; always positive — direction comes from `side`. */
	quantity: Positive,
	/** Price per share, or premium per share for options (before the multiplier). */
	price: NonNegative,
	/** Total commissions and fees for this execution, in account currency. */
	fees: NonNegative,
	executedAt: IsoDateTimeSchema,
	/** Underlying price at the moment of the fill. Enables IV/Greeks for options. */
	underlyingPrice: v.nullable(Positive),
	note: v.pipe(v.string(), v.maxLength(MAX_TEXT))
});
export type Execution = v.InferOutput<typeof ExecutionSchema>;

/** A stop or target, expressed on the underlying's price. Every move is kept. */
export const PriceLevelSchema = v.object({
	id: IdSchema,
	kind: v.picklist(['stop', 'target']),
	price: Positive,
	setAt: IsoDateTimeSchema,
	note: v.pipe(v.string(), v.maxLength(1000))
});
export type PriceLevel = v.InferOutput<typeof PriceLevelSchema>;

export const RatingSchema = v.nullable(
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5))
);

export const TradeSchema = v.pipe(
	v.object({
		id: IdSchema,
		accountId: IdSchema,
		underlying: SymbolSchema,
		assetClass: AssetClassSchema,
		/** `null` means "detect from the legs". A value is an explicit override. */
		strategy: v.nullable(StrategyKindSchema),
		playbookId: v.nullable(IdSchema),
		tagIds: v.pipe(v.array(IdSchema), v.maxLength(64)),
		legs: v.pipe(
			v.array(LegSchema),
			v.minLength(1, 'A trade needs at least one leg'),
			v.maxLength(16)
		),
		executions: v.pipe(v.array(ExecutionSchema), v.maxLength(2000)),
		levels: v.pipe(v.array(PriceLevelSchema), v.maxLength(500)),
		/** Dollar risk planned at entry. Takes precedence over stop- or structure-based risk. */
		plannedRisk: v.nullable(Positive),
		thesis: v.pipe(v.string(), v.maxLength(MAX_TEXT)),
		review: v.pipe(v.string(), v.maxLength(MAX_TEXT)),
		rating: RatingSchema,
		confidence: RatingSchema,
		/** Max favourable / adverse excursion in account currency, from market data. */
		mfe: v.nullable(FiniteNumber),
		mae: v.nullable(FiniteNumber),
		createdAt: IsoDateTimeSchema,
		updatedAt: IsoDateTimeSchema
	}),
	v.check((t) => {
		const legIds = new Set(t.legs.map((l) => l.id));
		return t.executions.every((e) => legIds.has(e.legId));
	}, 'Every execution must reference a leg of the same trade'),
	v.check(
		(t) => t.legs.every((l) => l.underlying === t.underlying),
		'Every leg must be on the trade underlying'
	),
	v.check((t) => {
		const ids = [...t.legs, ...t.executions, ...t.levels].map((x) => x.id);
		return new Set(ids).size === ids.length;
	}, 'Legs, executions and levels must have unique ids')
);
export type Trade = v.InferOutput<typeof TradeSchema>;

export const AccountSchema = v.object({
	id: IdSchema,
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Name is required'), v.maxLength(MAX_NAME)),
	broker: v.pipe(v.string(), v.trim(), v.maxLength(MAX_NAME)),
	currency: v.pipe(v.string(), v.length(3), v.toUpperCase()),
	startingBalance: NonNegative,
	archived: v.boolean(),
	createdAt: IsoDateTimeSchema
});
export type Account = v.InferOutput<typeof AccountSchema>;

export const TagCategorySchema = v.picklist(['setup', 'mistake', 'emotion', 'market', 'custom']);
export type TagCategory = v.InferOutput<typeof TagCategorySchema>;

export const HexColorSchema = v.pipe(v.string(), v.hexColor());

export const TagSchema = v.object({
	id: IdSchema,
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Name is required'), v.maxLength(60)),
	category: TagCategorySchema,
	color: HexColorSchema
});
export type Tag = v.InferOutput<typeof TagSchema>;

export const PlaybookSchema = v.object({
	id: IdSchema,
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Name is required'), v.maxLength(MAX_NAME)),
	description: v.pipe(v.string(), v.maxLength(MAX_TEXT)),
	/** Entry / exit / risk rules, checked off per trade during review. */
	rules: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(400))),
		v.maxLength(50)
	),
	color: HexColorSchema,
	archived: v.boolean(),
	createdAt: IsoDateTimeSchema
});
export type Playbook = v.InferOutput<typeof PlaybookSchema>;

export const NoteSchema = v.object({
	id: IdSchema,
	/** Trading day the note belongs to. */
	date: IsoDateSchema,
	title: v.pipe(v.string(), v.trim(), v.maxLength(200)),
	/** Plain text with light Markdown; rendered as text, never as HTML. */
	body: v.pipe(v.string(), v.maxLength(100_000)),
	kind: v.picklist(['premarket', 'recap', 'lesson', 'general']),
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema
});
export type Note = v.InferOutput<typeof NoteSchema>;

export const ThemeSchema = v.picklist(['system', 'dark', 'light']);

export const UserSettingsSchema = v.object({
	displayName: v.pipe(v.string(), v.trim(), v.maxLength(MAX_NAME)),
	/** IANA zone used to bucket trades into trading days. */
	timeZone: v.pipe(
		v.string(),
		v.check((tz) => {
			try {
				new Intl.DateTimeFormat('en-US', { timeZone: tz });
				return true;
			} catch {
				return false;
			}
		}, 'Unknown time zone')
	),
	baseCurrency: v.pipe(v.string(), v.length(3), v.toUpperCase()),
	/** Net P&L within ±this amount counts as breakeven. */
	breakevenThreshold: NonNegative,
	defaultCommissionPerContract: NonNegative,
	defaultCommissionPerShare: NonNegative,
	/** Annual risk-free rate (decimal) for Black-Scholes, e.g. 0.042. */
	riskFreeRate: v.pipe(v.number(), v.finite(), v.minValue(-0.05), v.maxValue(0.25)),
	theme: ThemeSchema,
	weekStartsOn: v.picklist([0, 1])
});
export type UserSettings = v.InferOutput<typeof UserSettingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = {
	displayName: '',
	timeZone: 'America/New_York',
	baseCurrency: 'USD',
	breakevenThreshold: 1,
	defaultCommissionPerContract: 0.65,
	defaultCommissionPerShare: 0,
	riskFreeRate: 0.04,
	theme: 'system',
	weekStartsOn: 1
};

export const ProviderIdSchema = v.picklist([
	'massive',
	'alpaca',
	'tiingo',
	'databento',
	'simulated'
]);
export type ProviderId = v.InferOutput<typeof ProviderIdSchema>;

/** Non-secret provider options (dataset, feed, …). Secrets are stored separately. */
export const ProviderOptionsSchema = v.record(
	v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/), v.maxLength(40)),
	v.pipe(v.string(), v.maxLength(200))
);

/** What the UI is allowed to see about a configured provider — never the secret. */
export const ProviderConfigViewSchema = v.object({
	id: IdSchema,
	provider: ProviderIdSchema,
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_NAME)),
	options: ProviderOptionsSchema,
	isDefault: v.boolean(),
	/** e.g. `••••3F9A` — last four characters of the key, for recognition only. */
	secretHint: v.nullable(v.pipe(v.string(), v.maxLength(16))),
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema
});
export type ProviderConfigView = v.InferOutput<typeof ProviderConfigViewSchema>;

/** Secret fields keyed by name (`apiKey`, `apiSecret`). */
export const ProviderSecretSchema = v.record(
	v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/), v.maxLength(40)),
	v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(512))
);
export type ProviderSecret = v.InferOutput<typeof ProviderSecretSchema>;

export const ProviderConfigInputSchema = v.object({
	id: IdSchema,
	provider: ProviderIdSchema,
	label: v.pipe(v.string(), v.trim(), v.minLength(1, 'Label is required'), v.maxLength(MAX_NAME)),
	options: ProviderOptionsSchema,
	isDefault: v.boolean(),
	/** `null` keeps the stored secret unchanged when editing. */
	secret: v.nullable(ProviderSecretSchema)
});
export type ProviderConfigInput = v.InferOutput<typeof ProviderConfigInputSchema>;

export const JournalExportSchema = v.object({
	format: v.literal('journalix.journal'),
	version: v.literal(1),
	exportedAt: IsoDateTimeSchema,
	settings: UserSettingsSchema,
	accounts: v.array(AccountSchema),
	tags: v.array(TagSchema),
	playbooks: v.array(PlaybookSchema),
	notes: v.array(NoteSchema),
	trades: v.array(TradeSchema)
});
export type JournalExport = v.InferOutput<typeof JournalExportSchema>;
