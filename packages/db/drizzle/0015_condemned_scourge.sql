CREATE TABLE "workspace_logo_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_logo_assets_size_check" CHECK ("workspace_logo_assets"."byte_size" between 1 and 1048576),
	CONSTRAINT "workspace_logo_assets_square_check" CHECK ("workspace_logo_assets"."width" = "workspace_logo_assets"."height")
);
--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "draft_content" SET DEFAULT '{"schemaVersion":3,"themeMode":"dark","settings":{"allowSearchIndexing":false,"siteTitle":"","siteDescription":"","primaryColor":"neutral","trackingConsentPopup":"popup-a","trackingPrivacyPolicyUrl":""},"variables":[{"id":"recipient_website","key":"website","label":"Website","type":"url","description":"The recipient company''s website.","defaultValue":""}],"pages":[{"id":"page-overview","name":"Overview","slug":"overview","status":"visible","sortOrder":0,"document":{"type":"doc","content":[{"type":"paragraph"}]}}],"sidebar":{"sections":{"tabs":{"label":"Tabs"},"links":{"label":"Links"},"nextSteps":{"label":"Next steps"}},"links":[],"nextSteps":[]}}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "site_defaults" jsonb;--> statement-breakpoint
ALTER TABLE "workspace_logo_assets" ADD CONSTRAINT "workspace_logo_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_logo_assets_workspace_idx" ON "workspace_logo_assets" USING btree ("workspace_id");
