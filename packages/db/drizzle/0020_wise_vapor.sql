ALTER TABLE "site_variants" ADD COLUMN "short_code" varchar(16);--> statement-breakpoint
ALTER TABLE "site_variants" ADD COLUMN "public_link_key" varchar(64);--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "public_id" varchar(16);--> statement-breakpoint
UPDATE "site_variants"
SET "short_code" = translate(substr(encode(uuid_send(gen_random_uuid()), 'base64'), 1, 12), '+/', '-_');--> statement-breakpoint
UPDATE "sites"
SET "public_id" = translate(substr(encode(uuid_send(gen_random_uuid()), 'base64'), 1, 12), '+/', '-_');--> statement-breakpoint
ALTER TABLE "site_variants" ALTER COLUMN "short_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "site_variants_short_code_idx" ON "site_variants" USING btree ("short_code");--> statement-breakpoint
CREATE UNIQUE INDEX "site_variants_site_public_link_idx" ON "site_variants" USING btree ("site_id","public_link_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_public_id_idx" ON "sites" USING btree ("public_id");
