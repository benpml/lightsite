WITH "candidate_workspaces" AS (
  SELECT
    "workspace"."id",
    0 AS "priority"
  FROM "user"
  INNER JOIN "user_profiles" AS "profile"
    ON "profile"."user_id" = "user"."id"
  INNER JOIN "workspaces" AS "workspace"
    ON "workspace"."id" = "profile"."last_active_workspace_id"
  INNER JOIN "workspace_members" AS "member"
    ON "member"."workspace_id" = "workspace"."id"
    AND "member"."user_id" = "user"."id"
  WHERE
    lower("user"."email") = 'hello@handout.link'
    AND "member"."status" = 'active'
    AND "workspace"."status" = 'active'

  UNION ALL

  SELECT
    "workspace"."id",
    1 AS "priority"
  FROM "user"
  INNER JOIN "workspace_members" AS "member"
    ON "member"."user_id" = "user"."id"
  INNER JOIN "workspaces" AS "workspace"
    ON "workspace"."id" = "member"."workspace_id"
  WHERE
    lower("user"."email") = 'hello@handout.link'
    AND "member"."status" = 'active'
    AND "workspace"."status" = 'active'
    AND "workspace"."name" = 'hello Team'
),
"target_workspace" AS (
  SELECT "id"
  FROM "candidate_workspaces"
  ORDER BY "priority", "id"
  LIMIT 1
)
UPDATE "workspaces"
SET
  "plan" = 'pro',
  "updated_at" = now()
WHERE "id" = (SELECT "id" FROM "target_workspace");
