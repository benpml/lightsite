ALTER TABLE "analytics_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracking_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracking_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "analytics_events" CASCADE;--> statement-breakpoint
DROP TABLE "tracking_events" CASCADE;--> statement-breakpoint
DROP TABLE "tracking_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "draft_content" SET DEFAULT '{"schemaVersion":2,"chrome":{"siteHeader":{"brandName":"Lightsite","logoUrl":"","primaryButtonText":"Book a call","primaryButtonHref":"","secondaryButtonText":"Learn more","secondaryButtonHref":"","showSecondaryButton":false},"hero":{"avatarMode":"single","eyebrow":"","title":"Untitled Lightsite","subtitle":"","avatarImageUrl":"","avatarImageVariableKey":"","avatarImageAlt":"","avatarImageSecondaryUrl":"","avatarImageSecondaryVariableKey":"","avatarImageSecondaryAlt":""}},"settings":{"showTableOfContents":true,"allowSearchIndexing":false},"variables":[{"id":"recipient_website","key":"recipient_website","label":"Recipient website","type":"url","defaultValue":""}],"blocks":[],"pages":[],"sidebar":{"sections":{"tabs":{"label":"Tabs"},"links":{"label":"Links"},"nextSteps":{"label":"Next steps"}},"links":[],"nextSteps":[]}}'::jsonb;--> statement-breakpoint
DROP TYPE "public"."analytics_event_type";--> statement-breakpoint
DROP TYPE "public"."tracking_event_source";--> statement-breakpoint
DROP TYPE "public"."tracking_event_type";--> statement-breakpoint
DROP TYPE "public"."tracking_session_state";