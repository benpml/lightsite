DO $$
DECLARE
  target_count integer;
  target_workspace_id uuid;
BEGIN
  SELECT
    count(*),
    (array_agg("workspace"."id" ORDER BY "workspace"."id"))[1]
  INTO target_count, target_workspace_id
  FROM "user"
  INNER JOIN "workspace_members" AS "member"
    ON "member"."user_id" = "user"."id"
  INNER JOIN "workspaces" AS "workspace"
    ON "workspace"."id" = "member"."workspace_id"
  WHERE
    lower("user"."email") = 'hello@handout.link'
    AND "member"."status" = 'active'
    AND "workspace"."status" = 'active'
    AND "workspace"."name" = 'hello Team';

  IF target_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one active hello Team workspace for hello@handout.link, found %',
      target_count;
  END IF;

  UPDATE "workspaces"
  SET
    "plan" = 'pro',
    "updated_at" = now()
  WHERE "id" = target_workspace_id;
END
$$;
