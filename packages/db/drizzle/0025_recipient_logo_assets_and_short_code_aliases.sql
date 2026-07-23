CREATE TABLE "recipient_logo_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"domain" varchar(253) NOT NULL,
	"theme" varchar(8) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipient_logo_assets_size_check" CHECK ("recipient_logo_assets"."byte_size" between 1 and 1048576),
	CONSTRAINT "recipient_logo_assets_square_check" CHECK ("recipient_logo_assets"."width" = "recipient_logo_assets"."height"),
	CONSTRAINT "recipient_logo_assets_theme_check" CHECK ("recipient_logo_assets"."theme" in ('light', 'dark'))
);
--> statement-breakpoint
CREATE TABLE "site_variant_short_code_aliases" (
	"short_code" varchar(16) PRIMARY KEY NOT NULL,
	"variant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipient_logo_assets" ADD CONSTRAINT "recipient_logo_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_variant_short_code_aliases" ADD CONSTRAINT "site_variant_short_code_aliases_variant_id_site_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."site_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipient_logo_assets_workspace_domain_theme_idx" ON "recipient_logo_assets" USING btree ("workspace_id","domain","theme");--> statement-breakpoint
CREATE INDEX "recipient_logo_assets_workspace_updated_at_idx" ON "recipient_logo_assets" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "site_variant_short_code_aliases_variant_idx" ON "site_variant_short_code_aliases" USING btree ("variant_id");--> statement-breakpoint
WITH "safe_candidates" AS (
	SELECT
		"variant"."id",
		"variant"."short_code" AS "old_code",
		left("variant"."short_code", 7) AS "new_code"
	FROM "site_variants" AS "variant"
	WHERE char_length("variant"."short_code") > 7
		AND NOT EXISTS (
			SELECT 1
			FROM "site_variants" AS "current_code"
			WHERE "current_code"."id" <> "variant"."id"
				AND "current_code"."short_code" = left("variant"."short_code", 7)
		)
		AND NOT EXISTS (
			SELECT 1
			FROM "site_variant_short_code_aliases" AS "alias"
			WHERE "alias"."short_code" = left("variant"."short_code", 7)
		)
		AND 1 = (
			SELECT count(*)
			FROM "site_variants" AS "same_prefix"
			WHERE char_length("same_prefix"."short_code") > 7
				AND left("same_prefix"."short_code", 7) = left("variant"."short_code", 7)
		)
)
INSERT INTO "site_variant_short_code_aliases" ("short_code", "variant_id")
SELECT "old_code", "id"
FROM "safe_candidates"
ON CONFLICT ("short_code") DO NOTHING;--> statement-breakpoint
WITH "safe_candidates" AS (
	SELECT
		"variant"."id",
		"variant"."short_code" AS "old_code",
		left("variant"."short_code", 7) AS "new_code"
	FROM "site_variants" AS "variant"
	WHERE char_length("variant"."short_code") > 7
		AND NOT EXISTS (
			SELECT 1
			FROM "site_variants" AS "current_code"
			WHERE "current_code"."id" <> "variant"."id"
				AND "current_code"."short_code" = left("variant"."short_code", 7)
		)
		AND NOT EXISTS (
			SELECT 1
			FROM "site_variant_short_code_aliases" AS "alias"
			WHERE "alias"."short_code" = left("variant"."short_code", 7)
		)
		AND 1 = (
			SELECT count(*)
			FROM "site_variants" AS "same_prefix"
			WHERE char_length("same_prefix"."short_code") > 7
				AND left("same_prefix"."short_code", 7) = left("variant"."short_code", 7)
		)
)
UPDATE "site_variants" AS "variant"
SET "short_code" = "candidate"."new_code"
FROM "safe_candidates" AS "candidate"
WHERE "variant"."id" = "candidate"."id"
	AND EXISTS (
		SELECT 1
		FROM "site_variant_short_code_aliases" AS "alias"
		WHERE "alias"."short_code" = "candidate"."old_code"
			AND "alias"."variant_id" = "candidate"."id"
	);
