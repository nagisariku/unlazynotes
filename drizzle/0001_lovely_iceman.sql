CREATE TABLE "ai_usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"feature" varchar(50) NOT NULL,
	"model" varchar(100),
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tag" varchar(100) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "raw_key" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "is_encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "vault_key" varchar(100);--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "is_processed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "target_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "schedule_dates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "schedule" jsonb DEFAULT '{"dates":[],"isRecurring":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "expenses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "income" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "debt" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "bookmark_type" varchar(50);--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "bookmark_meta" jsonb;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "credential_type" varchar(50);--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier" varchar(20) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_notes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_billing_period" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pro_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_searches" ADD CONSTRAINT "tag_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_user_id_idx" ON "ai_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_searches_user_tag_idx" ON "tag_searches" USING btree ("user_id","tag");--> statement-breakpoint
CREATE INDEX "notes_user_processed_idx" ON "notes" USING btree ("user_id","is_processed");--> statement-breakpoint
CREATE INDEX "notes_user_target_date_idx" ON "notes" USING btree ("user_id","target_date");--> statement-breakpoint
CREATE INDEX "notes_user_archived_idx" ON "notes" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "notes_expires_at_idx" ON "notes" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_telegram_chat_id_unique" UNIQUE("telegram_chat_id");