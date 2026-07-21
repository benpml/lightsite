CREATE TYPE "public"."webhook_automation_recipient_scope" AS ENUM('anyone', 'named', 'unnamed', 'selected');--> statement-breakpoint
CREATE TYPE "public"."webhook_automation_site_scope" AS ENUM('all', 'selected');--> statement-breakpoint
CREATE TYPE "public"."webhook_automation_state" AS ENUM('draft', 'enabled', 'paused', 'needs_attention');--> statement-breakpoint
CREATE TYPE "public"."webhook_automation_state_reason" AS ENUM('user', 'plan_changed', 'delivery_failures', 'usage_limit', 'queue_limit');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."webhook_fanout_status" AS ENUM('pending', 'complete', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."webhook_message_kind" AS ENUM('live', 'test');--> statement-breakpoint
CREATE TABLE "webhook_automation_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"trigger" jsonb NOT NULL,
	"endpoint_ciphertext" text NOT NULL,
	"endpoint_nonce" varchar(64) NOT NULL,
	"signing_secret_ciphertext" text NOT NULL,
	"signing_secret_nonce" varchar(64) NOT NULL,
	"retired_at" timestamp with time zone,
	"created_by_user_id" varchar(191),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_automation_revisions_number_check" CHECK ("webhook_automation_revisions"."revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"state" "webhook_automation_state" DEFAULT 'draft' NOT NULL,
	"state_reason" "webhook_automation_state_reason",
	"endpoint_host" varchar(253) NOT NULL,
	"current_revision_id" uuid,
	"consecutive_failure_count" integer DEFAULT 0 NOT NULL,
	"last_delivery_at" timestamp with time zone,
	"last_delivery_status" "webhook_delivery_status",
	"created_by_user_id" varchar(191),
	"updated_by_user_id" varchar(191),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_automations_failure_count_check" CHECK ("webhook_automations"."consecutive_failure_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"manual_retry_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_until" timestamp with time zone,
	"lease_token" uuid,
	"response_status" integer,
	"error_code" varchar(80),
	"last_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_attempts_check" CHECK ("webhook_deliveries"."attempt_count" >= 0 and "webhook_deliveries"."attempt_count" <= 10 and "webhook_deliveries"."manual_retry_count" >= 0 and "webhook_deliveries"."manual_retry_count" <= 3)
);
--> statement-breakpoint
CREATE TABLE "webhook_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_event_row_id" uuid,
	"event_id" varchar(160) NOT NULL,
	"event_type" "tracking_recipient_event_type" NOT NULL,
	"kind" "webhook_message_kind" DEFAULT 'live' NOT NULL,
	"payload" jsonb,
	"payload_text" text,
	"payload_redacted_at" timestamp with time zone,
	"fanout_status" "webhook_fanout_status" DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_until" timestamp with time zone,
	"lease_token" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_usage_monthly" (
	"workspace_id" uuid NOT NULL,
	"month" date NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"succeeded_deliveries" integer DEFAULT 0 NOT NULL,
	"failed_deliveries" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_usage_monthly_counts_check" CHECK ("webhook_usage_monthly"."delivery_attempts" >= 0 and "webhook_usage_monthly"."succeeded_deliveries" >= 0 and "webhook_usage_monthly"."failed_deliveries" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_workspace_queue_state" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"pending_messages" integer DEFAULT 0 NOT NULL,
	"pending_deliveries" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_workspace_queue_state_counts_check" CHECK ("webhook_workspace_queue_state"."pending_messages" >= 0 and "webhook_workspace_queue_state"."pending_deliveries" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "draft_content" SET DEFAULT '{"schemaVersion":3,"themeMode":"dark","settings":{"allowSearchIndexing":false,"siteTitle":"","siteDescription":"","primaryColor":"neutral","trackingConsentPopup":"popup-a","trackingPrivacyPolicyUrl":"https://www.handout.link/privacy"},"variables":[{"id":"recipient_website","key":"website","label":"Website","type":"url","description":"The recipient company''s website.","defaultValue":""}],"pages":[{"id":"page-overview","name":"Overview","slug":"overview","status":"visible","sortOrder":0,"document":{"type":"doc","content":[{"type":"paragraph"}]}}],"sidebar":{"sections":{"tabs":{"label":"Tabs"},"links":{"label":"Links"},"nextSteps":{"label":"Next steps"}},"links":[],"nextSteps":[]}}'::jsonb;--> statement-breakpoint
ALTER TABLE "webhook_automation_revisions" ADD CONSTRAINT "webhook_automation_revisions_automation_id_webhook_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."webhook_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_automation_revisions" ADD CONSTRAINT "webhook_automation_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_automation_revisions" ADD CONSTRAINT "webhook_automation_revisions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_automations" ADD CONSTRAINT "webhook_automations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_automations" ADD CONSTRAINT "webhook_automations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_automations" ADD CONSTRAINT "webhook_automations_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_automation_id_webhook_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."webhook_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_revision_id_webhook_automation_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."webhook_automation_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_message_id_webhook_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."webhook_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_messages" ADD CONSTRAINT "webhook_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_usage_monthly" ADD CONSTRAINT "webhook_usage_monthly_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_workspace_queue_state" ADD CONSTRAINT "webhook_workspace_queue_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_automation_revisions_number_idx" ON "webhook_automation_revisions" USING btree ("automation_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_automation_revisions_identity_idx" ON "webhook_automation_revisions" USING btree ("automation_id","id");--> statement-breakpoint
CREATE INDEX "webhook_automation_revisions_workspace_created_idx" ON "webhook_automation_revisions" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_automations_workspace_state_idx" ON "webhook_automations" USING btree ("workspace_id","state");--> statement-breakpoint
CREATE INDEX "webhook_automations_current_revision_idx" ON "webhook_automations" USING btree ("current_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_message_automation_idx" ON "webhook_deliveries" USING btree ("message_id","automation_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_dispatch_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_automation_created_idx" ON "webhook_deliveries" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_workspace_created_idx" ON "webhook_deliveries" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_messages_event_kind_idx" ON "webhook_messages" USING btree ("workspace_id","event_id","kind");--> statement-breakpoint
CREATE INDEX "webhook_messages_fanout_idx" ON "webhook_messages" USING btree ("fanout_status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "webhook_messages_workspace_created_idx" ON "webhook_messages" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_usage_monthly_workspace_month_idx" ON "webhook_usage_monthly" USING btree ("workspace_id","month");
