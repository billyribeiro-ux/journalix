CREATE TYPE "public"."asset_class" AS ENUM('stock', 'option', 'future', 'crypto', 'forex');--> statement-breakpoint
CREATE TYPE "public"."execution_kind" AS ENUM('fill', 'expiration', 'assignment', 'exercise');--> statement-breakpoint
CREATE TYPE "public"."leg_kind" AS ENUM('stock', 'call', 'put', 'future', 'crypto', 'forex');--> statement-breakpoint
CREATE TYPE "public"."level_kind" AS ENUM('stop', 'target');--> statement-breakpoint
CREATE TYPE "public"."note_kind" AS ENUM('premarket', 'recap', 'lesson', 'general');--> statement-breakpoint
CREATE TYPE "public"."provider_kind" AS ENUM('massive', 'alpaca', 'tiingo', 'databento', 'simulated');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('setup', 'mistake', 'emotion', 'market', 'custom');--> statement-breakpoint
CREATE TABLE "bar_cache" (
	"provider_config_id" uuid NOT NULL,
	"instrument" text NOT NULL,
	"timeframe" text NOT NULL,
	"time" bigint NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision NOT NULL,
	CONSTRAINT "bar_cache_provider_config_id_instrument_timeframe_time_pk" PRIMARY KEY("provider_config_id","instrument","timeframe","time")
);
--> statement-breakpoint
CREATE TABLE "bar_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_config_id" uuid NOT NULL,
	"instrument" text NOT NULL,
	"timeframe" text NOT NULL,
	"from_ms" bigint NOT NULL,
	"to_ms" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"kind" "note_kind" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"color" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_config" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" "provider_kind" NOT NULL,
	"label" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"secret_ciphertext" text,
	"secret_hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" "tag_category" NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"underlying" text NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"strategy" text,
	"playbook_id" uuid,
	"planned_risk" numeric(20, 6),
	"thesis" text DEFAULT '' NOT NULL,
	"review" text DEFAULT '' NOT NULL,
	"rating" smallint,
	"confidence" smallint,
	"mfe" numeric(20, 6),
	"mae" numeric(20, 6),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trade_rating_range" CHECK ("trade"."rating" is null or "trade"."rating" between 1 and 5),
	CONSTRAINT "trade_confidence_range" CHECK ("trade"."confidence" is null or "trade"."confidence" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "trade_execution" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trade_id" uuid NOT NULL,
	"leg_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"kind" "execution_kind" NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"fees" numeric(20, 6) DEFAULT 0 NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"underlying_price" numeric(20, 8),
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "trade_execution_quantity_positive" CHECK ("trade_execution"."quantity" > 0),
	CONSTRAINT "trade_execution_price_nonnegative" CHECK ("trade_execution"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trade_leg" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trade_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "leg_kind" NOT NULL,
	"underlying" text NOT NULL,
	"strike" numeric(20, 8),
	"expiration" date,
	"multiplier" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_level" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trade_id" uuid NOT NULL,
	"kind" "level_kind" NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"set_at" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_tag" (
	"trade_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "trade_tag_trade_id_tag_id_pk" PRIMARY KEY("trade_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "trading_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"broker" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"starting_balance" numeric(20, 6) DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bar_cache" ADD CONSTRAINT "bar_cache_provider_config_id_provider_config_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "public"."provider_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bar_coverage" ADD CONSTRAINT "bar_coverage_provider_config_id_provider_config_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "public"."provider_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook" ADD CONSTRAINT "playbook_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_config" ADD CONSTRAINT "provider_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_playbook_id_playbook_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbook"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_execution" ADD CONSTRAINT "trade_execution_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_execution" ADD CONSTRAINT "trade_execution_leg_id_trade_leg_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."trade_leg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_leg" ADD CONSTRAINT "trade_leg_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_level" ADD CONSTRAINT "trade_level_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_account" ADD CONSTRAINT "trading_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bar_coverage_lookup_idx" ON "bar_coverage" USING btree ("provider_config_id","instrument","timeframe");--> statement-breakpoint
CREATE INDEX "note_user_date_idx" ON "note" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "playbook_user_idx" ON "playbook" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_config_user_idx" ON "provider_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tag_user_idx" ON "tag" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_user_idx" ON "trade" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_account_idx" ON "trade" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "trade_user_underlying_idx" ON "trade" USING btree ("user_id","underlying");--> statement-breakpoint
CREATE INDEX "trade_execution_trade_idx" ON "trade_execution" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trade_leg_trade_idx" ON "trade_leg" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trade_level_trade_idx" ON "trade_level" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trade_tag_tag_idx" ON "trade_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "trading_account_user_idx" ON "trading_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");