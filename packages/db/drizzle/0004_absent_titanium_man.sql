CREATE TABLE "tracking_recording_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"public_session_id" varchar(160) NOT NULL,
	"sequence" integer NOT NULL,
	"object_key" text NOT NULL,
	"event_count" integer NOT NULL,
	"compressed_bytes" integer NOT NULL,
	"uncompressed_bytes" integer,
	"checksum_sha256" varchar(128) NOT NULL,
	"first_event_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_recording_chunks_check" CHECK ("tracking_recording_chunks"."sequence" >= 0
        and "tracking_recording_chunks"."event_count" > 0
        and "tracking_recording_chunks"."compressed_bytes" > 0
        and ("tracking_recording_chunks"."uncompressed_bytes" is null or "tracking_recording_chunks"."uncompressed_bytes" >= "tracking_recording_chunks"."compressed_bytes")
        and ("tracking_recording_chunks"."first_event_at" is null or "tracking_recording_chunks"."last_event_at" is null or "tracking_recording_chunks"."last_event_at" >= "tracking_recording_chunks"."first_event_at"))
);
--> statement-breakpoint
CREATE TABLE "tracking_recording_usage_daily" (
	"workspace_id" uuid NOT NULL,
	"date" date NOT NULL,
	"recording_count" integer DEFAULT 0 NOT NULL,
	"compressed_bytes" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "tracking_recording_usage_daily_check" CHECK ("tracking_recording_usage_daily"."recording_count" >= 0 and "tracking_recording_usage_daily"."compressed_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tracking_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"recipient_id" uuid,
	"session_id" uuid NOT NULL,
	"public_session_id" varchar(160) NOT NULL,
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"rrweb_version" varchar(40) DEFAULT 'lightsite-minimal-v1' NOT NULL,
	"runtime_version" varchar(80) NOT NULL,
	"privacy_version" integer DEFAULT 1 NOT NULL,
	"upload_token_hash" varchar(128) NOT NULL,
	"max_duration_ms" integer NOT NULL,
	"max_chunk_bytes" integer NOT NULL,
	"max_events" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"compressed_bytes" integer DEFAULT 0 NOT NULL,
	"object_prefix" text NOT NULL,
	"stop_reason" varchar(80),
	"error_code" varchar(80),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_recordings_status_check" CHECK ("tracking_recordings"."status" in ('pending', 'recording', 'available', 'truncated', 'failed', 'expired', 'deleted')),
	CONSTRAINT "tracking_recordings_duration_check" CHECK ("tracking_recordings"."duration_ms" >= 0
        and "tracking_recordings"."event_count" >= 0
        and "tracking_recordings"."chunk_count" >= 0
        and "tracking_recordings"."compressed_bytes" >= 0
        and "tracking_recordings"."max_duration_ms" between 60000 and 600000
        and "tracking_recordings"."max_chunk_bytes" between 1024 and 61440
        and "tracking_recordings"."max_events" between 1 and 20000
        and ("tracking_recordings"."ended_at" is null or "tracking_recordings"."ended_at" >= "tracking_recordings"."started_at"))
);
--> statement-breakpoint
ALTER TABLE "tracking_recording_chunks" ADD CONSTRAINT "tracking_recording_chunks_recording_id_tracking_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."tracking_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recording_chunks" ADD CONSTRAINT "tracking_recording_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recording_chunks" ADD CONSTRAINT "trk_recording_chunks_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tracking_recipient_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recording_usage_daily" ADD CONSTRAINT "tracking_recording_usage_daily_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recordings" ADD CONSTRAINT "tracking_recordings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recordings" ADD CONSTRAINT "tracking_recordings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recordings" ADD CONSTRAINT "tracking_recordings_recipient_id_site_variants_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."site_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_recordings" ADD CONSTRAINT "trk_recordings_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tracking_recipient_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_recording_chunks_recording_sequence_idx" ON "tracking_recording_chunks" USING btree ("recording_id","sequence");--> statement-breakpoint
CREATE INDEX "tracking_recording_chunks_workspace_received_idx" ON "tracking_recording_chunks" USING btree ("workspace_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_recording_usage_daily_workspace_date_idx" ON "tracking_recording_usage_daily" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_recordings_session_unique_idx" ON "tracking_recordings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "tracking_recordings_workspace_started_idx" ON "tracking_recordings" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "tracking_recordings_status_expires_idx" ON "tracking_recordings" USING btree ("status","expires_at");