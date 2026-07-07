CREATE TYPE "public"."tracking_event_source" AS ENUM('browser', 'preview_html', 'preview_og_image');--> statement-breakpoint
CREATE TYPE "public"."tracking_event_type" AS ENUM('site_viewed', 'heartbeat', 'scroll_depth_reached', 'element_clicked', 'button_clicked', 'link_clicked', 'calendar_booked', 'link_preview_loaded');--> statement-breakpoint
CREATE TYPE "public"."tracking_session_state" AS ENUM('active', 'ended', 'expired', 'bot_filtered', 'discarded');--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(160) NOT NULL,
	"batch_id" varchar(160) NOT NULL,
	"visitor_session_id" varchar(160),
	"workspace_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"variant_id" uuid,
	"variant_revision" integer,
	"published_version_id" uuid NOT NULL,
	"type" "tracking_event_type" NOT NULL,
	"source" "tracking_event_source" NOT NULL,
	"event_name" varchar(160) NOT NULL,
	"element_id" varchar(160),
	"target_label" varchar(180),
	"target_url" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_sessions" (
	"id" varchar(160) PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"variant_id" uuid,
	"variant_revision" integer,
	"published_version_id" uuid NOT NULL,
	"state" "tracking_session_state" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" integer,
	"max_scroll_depth" integer,
	"referrer_host" varchar(253),
	"browser_name" varchar(80),
	"os_name" varchar(80),
	"device_type" varchar(40),
	"country" varchar(2),
	"is_bot" boolean DEFAULT false NOT NULL,
	"bot_name" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_visitor_session_id_tracking_sessions_id_fk" FOREIGN KEY ("visitor_session_id") REFERENCES "public"."tracking_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_variant_id_site_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."site_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_published_version_id_site_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."site_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_variant_id_site_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."site_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_published_version_id_site_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."site_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_events_event_id_idx" ON "tracking_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tracking_events_workspace_received_at_idx" ON "tracking_events" USING btree ("workspace_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_events_site_received_at_idx" ON "tracking_events" USING btree ("site_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_events_variant_received_at_idx" ON "tracking_events" USING btree ("variant_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_events_session_received_at_idx" ON "tracking_events" USING btree ("visitor_session_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_sessions_workspace_started_at_idx" ON "tracking_sessions" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "tracking_sessions_site_started_at_idx" ON "tracking_sessions" USING btree ("site_id","started_at");--> statement-breakpoint
CREATE INDEX "tracking_sessions_variant_started_at_idx" ON "tracking_sessions" USING btree ("variant_id","started_at");