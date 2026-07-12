CREATE TYPE "public"."tracking_element_kind" AS ENUM('button', 'link', 'tab', 'sidebar_button', 'sidebar_link', 'image_card', 'calendar', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."tracking_recipient_event_source" AS ENUM('browser', 'server', 'slack_og_image', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."tracking_recipient_event_type" AS ENUM('site_visit', 'button_click', 'link_click', 'tab_switch', 'slack_share', 'webhook_send');--> statement-breakpoint
CREATE TYPE "public"."tracking_recipient_session_end_reason" AS ENUM('pagehide', 'visibility_timeout', 'idle_timeout', 'max_duration', 'heartbeat_timeout', 'server_expired', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."tracking_recipient_session_state" AS ENUM('active', 'ended', 'expired', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."tracking_recording_status" AS ENUM('disabled', 'pending', 'available', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tracking_setting_scope" AS ENUM('workspace', 'site', 'recipient');--> statement-breakpoint
CREATE TYPE "public"."tracking_suppression_marker_type" AS ENUM('ip_address', 'device_id', 'user_id', 'email_domain');--> statement-breakpoint
CREATE TABLE "tracking_internal_ip_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ip_range" "cidr" NOT NULL,
	"label" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" varchar(191),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_recipient_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(160) NOT NULL,
	"batch_id" varchar(160),
	"session_id" uuid,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"recipient_id" uuid,
	"published_version_id" uuid,
	"type" "tracking_recipient_event_type" NOT NULL,
	"source" "tracking_recipient_event_source" NOT NULL,
	"tab_label" varchar(180),
	"element_kind" "tracking_element_kind",
	"element_id" varchar(160),
	"element_label" varchar(180),
	"element_href" text,
	"webhook_id" uuid,
	"webhook_url" text,
	"script_version" varchar(80),
	"request_id" varchar(160),
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_recipient_events_session_scope_check" CHECK ((
        ("tracking_recipient_events"."type" in ('site_visit', 'button_click', 'link_click', 'tab_switch') and "tracking_recipient_events"."session_id" is not null)
        or ("tracking_recipient_events"."type" in ('slack_share', 'webhook_send') and "tracking_recipient_events"."session_id" is null)
      )),
	CONSTRAINT "tracking_recipient_events_source_check" CHECK ((
        ("tracking_recipient_events"."type" in ('site_visit', 'button_click', 'link_click', 'tab_switch') and "tracking_recipient_events"."source" = 'browser')
        or ("tracking_recipient_events"."type" = 'slack_share' and "tracking_recipient_events"."source" = 'slack_og_image')
        or ("tracking_recipient_events"."type" = 'webhook_send' and "tracking_recipient_events"."source" = 'webhook')
      )),
	CONSTRAINT "tracking_recipient_events_element_check" CHECK ((
        ("tracking_recipient_events"."type" in ('button_click', 'link_click', 'tab_switch') and "tracking_recipient_events"."element_label" is not null)
        or ("tracking_recipient_events"."type" not in ('button_click', 'link_click', 'tab_switch'))
      )),
	CONSTRAINT "tracking_recipient_events_click_data_check" CHECK ((
        ("tracking_recipient_events"."type" = 'link_click' and "tracking_recipient_events"."element_href" is not null and "tracking_recipient_events"."element_kind" in ('link', 'sidebar_link'))
        or ("tracking_recipient_events"."type" = 'tab_switch' and "tracking_recipient_events"."element_kind" = 'tab')
        or ("tracking_recipient_events"."type" = 'button_click' and "tracking_recipient_events"."element_kind" in ('button', 'sidebar_button', 'image_card', 'calendar', 'unknown'))
        or ("tracking_recipient_events"."type" not in ('button_click', 'link_click', 'tab_switch'))
      )),
	CONSTRAINT "tracking_recipient_events_webhook_data_check" CHECK ((
        ("tracking_recipient_events"."type" = 'webhook_send' and "tracking_recipient_events"."webhook_id" is not null and "tracking_recipient_events"."webhook_url" is not null)
        or ("tracking_recipient_events"."type" <> 'webhook_send')
      ))
);
--> statement-breakpoint
CREATE TABLE "tracking_recipient_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_session_id" varchar(160) NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"recipient_id" uuid,
	"published_version_id" uuid NOT NULL,
	"state" "tracking_recipient_session_state" DEFAULT 'active' NOT NULL,
	"event_token_hash" varchar(128) NOT NULL,
	"device_id_hash" varchar(128),
	"ip_address" "inet",
	"ip_address_hash" varchar(128),
	"city" varchar(120),
	"region" varchar(120),
	"country_code" varchar(2),
	"device_type" varchar(40),
	"os_name" varchar(80),
	"browser_name" varchar(80),
	"user_agent_family" varchar(120),
	"referrer_host" varchar(253),
	"initial_path" varchar(2048),
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" "tracking_recipient_session_end_reason",
	"active_ms" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"max_scroll_depth_percent" integer,
	"recording_status" "tracking_recording_status" DEFAULT 'disabled' NOT NULL,
	"recording_object_key" text,
	"recording_duration_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_recipient_sessions_ended_check" CHECK ("tracking_recipient_sessions"."ended_at" is null or "tracking_recipient_sessions"."ended_at" >= "tracking_recipient_sessions"."started_at"),
	CONSTRAINT "tracking_recipient_sessions_duration_check" CHECK ("tracking_recipient_sessions"."active_ms" >= 0
        and ("tracking_recipient_sessions"."duration_ms" is null or "tracking_recipient_sessions"."duration_ms" >= 0)
        and ("tracking_recipient_sessions"."max_scroll_depth_percent" is null or "tracking_recipient_sessions"."max_scroll_depth_percent" between 0 and 100))
);
--> statement-breakpoint
CREATE TABLE "tracking_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid,
	"recipient_id" uuid,
	"scope" "tracking_setting_scope" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"capture_ip_address" boolean DEFAULT true NOT NULL,
	"raw_ip_retention_days" integer DEFAULT 30 NOT NULL,
	"event_retention_days" integer DEFAULT 365 NOT NULL,
	"recording_enabled" boolean DEFAULT false NOT NULL,
	"recording_retention_days" integer DEFAULT 30 NOT NULL,
	"max_recording_duration_seconds" integer DEFAULT 600 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_settings_scope_check" CHECK ((
        ("tracking_settings"."scope" = 'workspace' and "tracking_settings"."site_id" is null and "tracking_settings"."recipient_id" is null)
        or ("tracking_settings"."scope" = 'site' and "tracking_settings"."site_id" is not null and "tracking_settings"."recipient_id" is null)
        or ("tracking_settings"."scope" = 'recipient' and "tracking_settings"."site_id" is not null and "tracking_settings"."recipient_id" is not null)
      )),
	CONSTRAINT "tracking_settings_retention_check" CHECK ("tracking_settings"."raw_ip_retention_days" >= 0
        and "tracking_settings"."event_retention_days" >= "tracking_settings"."raw_ip_retention_days"
        and "tracking_settings"."recording_retention_days" >= 0
        and "tracking_settings"."max_recording_duration_seconds" between 60 and 600)
);
--> statement-breakpoint
CREATE TABLE "tracking_suppression_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" varchar(191),
	"marker_type" "tracking_suppression_marker_type" NOT NULL,
	"marker_hash" varchar(128) NOT NULL,
	"label" varchar(160),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_suppression_seen_check" CHECK ("tracking_suppression_markers"."last_seen_at" >= "tracking_suppression_markers"."first_seen_at")
);
--> statement-breakpoint
ALTER TABLE "tracking_internal_ip_ranges" ADD CONSTRAINT "tracking_internal_ip_ranges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_internal_ip_ranges" ADD CONSTRAINT "tracking_internal_ip_ranges_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_events" ADD CONSTRAINT "tracking_recipient_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_events" ADD CONSTRAINT "tracking_recipient_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_events" ADD CONSTRAINT "tracking_recipient_events_recipient_id_site_variants_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."site_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_events" ADD CONSTRAINT "trk_rec_events_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tracking_recipient_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_events" ADD CONSTRAINT "trk_rec_events_version_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."site_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_sessions" ADD CONSTRAINT "tracking_recipient_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_sessions" ADD CONSTRAINT "tracking_recipient_sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_sessions" ADD CONSTRAINT "tracking_recipient_sessions_recipient_id_site_variants_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."site_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recipient_sessions" ADD CONSTRAINT "trk_rec_sessions_version_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."site_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_settings" ADD CONSTRAINT "tracking_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_settings" ADD CONSTRAINT "tracking_settings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_settings" ADD CONSTRAINT "tracking_settings_recipient_id_site_variants_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."site_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_suppression_markers" ADD CONSTRAINT "tracking_suppression_markers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_suppression_markers" ADD CONSTRAINT "tracking_suppression_markers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_internal_ip_workspace_range_idx" ON "tracking_internal_ip_ranges" USING btree ("workspace_id","ip_range");--> statement-breakpoint
CREATE INDEX "tracking_internal_ip_workspace_enabled_idx" ON "tracking_internal_ip_ranges" USING btree ("workspace_id","enabled");--> statement-breakpoint
CREATE INDEX "tracking_internal_ip_range_gist_idx" ON "tracking_internal_ip_ranges" USING gist ("ip_range" inet_ops) WHERE "enabled" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_recipient_events_event_id_idx" ON "tracking_recipient_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tracking_recipient_events_workspace_received_idx" ON "tracking_recipient_events" USING btree ("workspace_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_events_site_received_idx" ON "tracking_recipient_events" USING btree ("site_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_events_recipient_received_idx" ON "tracking_recipient_events" USING btree ("recipient_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_events_session_received_idx" ON "tracking_recipient_events" USING btree ("session_id","received_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_events_workspace_type_received_idx" ON "tracking_recipient_events" USING btree ("workspace_id","type","received_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_events_webhook_idx" ON "tracking_recipient_events" USING btree ("webhook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_recipient_sessions_public_idx" ON "tracking_recipient_sessions" USING btree ("public_session_id");--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_workspace_started_idx" ON "tracking_recipient_sessions" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_site_started_idx" ON "tracking_recipient_sessions" USING btree ("site_id","started_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_recipient_started_idx" ON "tracking_recipient_sessions" USING btree ("recipient_id","started_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_workspace_seen_idx" ON "tracking_recipient_sessions" USING btree ("workspace_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_active_seen_idx" ON "tracking_recipient_sessions" USING btree ("last_seen_at") WHERE "tracking_recipient_sessions"."state" = 'active';--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_device_hash_idx" ON "tracking_recipient_sessions" USING btree ("workspace_id","device_id_hash");--> statement-breakpoint
CREATE INDEX "tracking_recipient_sessions_ip_hash_idx" ON "tracking_recipient_sessions" USING btree ("workspace_id","ip_address_hash");--> statement-breakpoint
CREATE INDEX "tracking_settings_workspace_scope_idx" ON "tracking_settings" USING btree ("workspace_id","scope");--> statement-breakpoint
CREATE INDEX "tracking_settings_site_idx" ON "tracking_settings" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "tracking_settings_recipient_idx" ON "tracking_settings" USING btree ("recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_settings_workspace_unique_idx" ON "tracking_settings" USING btree ("workspace_id") WHERE "tracking_settings"."scope" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_settings_site_unique_idx" ON "tracking_settings" USING btree ("site_id") WHERE "tracking_settings"."scope" = 'site';--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_settings_recipient_unique_idx" ON "tracking_settings" USING btree ("recipient_id") WHERE "tracking_settings"."scope" = 'recipient';--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_suppression_workspace_marker_idx" ON "tracking_suppression_markers" USING btree ("workspace_id","marker_type","marker_hash");--> statement-breakpoint
CREATE INDEX "tracking_suppression_marker_hash_idx" ON "tracking_suppression_markers" USING btree ("marker_hash");--> statement-breakpoint
CREATE INDEX "tracking_suppression_user_seen_idx" ON "tracking_suppression_markers" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "tracking_suppression_expires_idx" ON "tracking_suppression_markers" USING btree ("expires_at");
