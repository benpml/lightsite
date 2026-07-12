ALTER TABLE "tracking_recordings" DROP CONSTRAINT "tracking_recordings_duration_check";--> statement-breakpoint
ALTER TABLE "tracking_recordings" ALTER COLUMN "rrweb_version" SET DEFAULT 'lightsite-minimal-v1';--> statement-breakpoint
UPDATE "tracking_recordings" SET "max_chunk_bytes" = 61440 WHERE "max_chunk_bytes" > 61440;--> statement-breakpoint
ALTER TABLE "tracking_recordings" ADD CONSTRAINT "tracking_recordings_duration_check" CHECK ("tracking_recordings"."duration_ms" >= 0
        and "tracking_recordings"."event_count" >= 0
        and "tracking_recordings"."chunk_count" >= 0
        and "tracking_recordings"."compressed_bytes" >= 0
        and "tracking_recordings"."max_duration_ms" between 60000 and 600000
        and "tracking_recordings"."max_chunk_bytes" between 1024 and 61440
        and "tracking_recordings"."max_events" between 1 and 20000
        and ("tracking_recordings"."final_sequence" is null or "tracking_recordings"."final_sequence" >= 0)
        and ("tracking_recordings"."ended_at" is null or "tracking_recordings"."ended_at" >= "tracking_recordings"."started_at"));
