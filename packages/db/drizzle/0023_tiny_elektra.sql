ALTER TABLE "tracking_recording_chunks" ADD COLUMN "has_full_snapshot" boolean;

UPDATE "tracking_recording_chunks"
SET "has_full_snapshot" = CASE
  WHEN "sequence" = 0 AND "event_count" >= 2 AND "uncompressed_bytes" >= 1024 THEN true
  WHEN "uncompressed_bytes" < 1024 THEN false
  ELSE NULL
END;

UPDATE "tracking_recordings" AS "recording"
SET
  "status" = 'failed',
  "error_code" = 'missing_snapshot',
  "updated_at" = now()
WHERE
  "recording"."status" IN ('available', 'truncated')
  AND EXISTS (
    SELECT 1
    FROM "tracking_recording_chunks" AS "chunk"
    WHERE "chunk"."recording_id" = "recording"."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "tracking_recording_chunks" AS "chunk"
    WHERE
      "chunk"."recording_id" = "recording"."id"
      AND "chunk"."has_full_snapshot" IS DISTINCT FROM false
  );

UPDATE "tracking_recipient_sessions" AS "session"
SET
  "recording_status" = 'failed',
  "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "tracking_recordings" AS "recording"
  WHERE
    "recording"."session_id" = "session"."id"
    AND "recording"."status" = 'failed'
    AND "recording"."error_code" = 'missing_snapshot'
);
