CREATE TABLE "workspace_billing" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_price_id" varchar(255),
	"plan" text DEFAULT 'free' NOT NULL,
	"billing_interval" varchar(16),
	"subscription_status" varchar(64),
	"seat_count" integer DEFAULT 1 NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_billing" ALTER COLUMN "plan" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspace_billing" ALTER COLUMN "plan" SET DEFAULT 'free'::text;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "plan" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "plan" SET DEFAULT 'free'::text;--> statement-breakpoint
DROP TYPE "public"."workspace_plan";--> statement-breakpoint
CREATE TYPE "public"."workspace_plan" AS ENUM('free', 'core', 'pro');--> statement-breakpoint
UPDATE "workspaces" SET "plan" = 'free' WHERE "plan" = 'basic';--> statement-breakpoint
UPDATE "workspaces" SET "plan" = 'core' WHERE "plan" = 'pro';--> statement-breakpoint
ALTER TABLE "workspace_billing" ALTER COLUMN "plan" SET DEFAULT 'free'::"public"."workspace_plan";--> statement-breakpoint
ALTER TABLE "workspace_billing" ALTER COLUMN "plan" SET DATA TYPE "public"."workspace_plan" USING "plan"::"public"."workspace_plan";--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "plan" SET DEFAULT 'free'::"public"."workspace_plan";--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "plan" SET DATA TYPE "public"."workspace_plan" USING "plan"::"public"."workspace_plan";--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "draft_content" SET DEFAULT '{"schemaVersion":2,"chrome":{"siteHeader":{"brandName":"Lightsite","logoUrl":"","primaryButtonText":"Book a call","primaryButtonHref":"","secondaryButtonText":"Learn more","secondaryButtonHref":"","showSecondaryButton":false},"hero":{"avatarMode":"single","eyebrow":"","title":"Untitled Lightsite","subtitle":"","avatarImageUrl":"","avatarImageVariableKey":"","avatarImageAlt":"","avatarImageSecondaryUrl":"","avatarImageSecondaryVariableKey":"","avatarImageSecondaryAlt":""}},"settings":{"showTableOfContents":true,"allowSearchIndexing":false},"variables":[{"id":"recipient_website","key":"recipient_website","label":"Recipient website","type":"url","defaultValue":""}],"blocks":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD CONSTRAINT "workspace_billing_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_stripe_customer_idx" ON "workspace_billing" USING btree ("stripe_customer_id") WHERE "workspace_billing"."stripe_customer_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_stripe_subscription_idx" ON "workspace_billing" USING btree ("stripe_subscription_id") WHERE "workspace_billing"."stripe_subscription_id" is not null;--> statement-breakpoint
CREATE INDEX "workspace_billing_plan_status_idx" ON "workspace_billing" USING btree ("plan","subscription_status");
