CREATE TYPE "public"."workspace_asset_purpose" AS ENUM('image', 'logo', 'og_image', 'avatar');--> statement-breakpoint
CREATE TABLE "workspace_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"uploaded_by_user_id" varchar(191) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"purpose" "workspace_asset_purpose" DEFAULT 'image' NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"source_host" varchar(253),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_assets_size_check" CHECK ("workspace_assets"."byte_size" between 1 and 5242880),
	CONSTRAINT "workspace_assets_dimensions_check" CHECK ("workspace_assets"."width" between 1 and 12000 and "workspace_assets"."height" between 1 and 12000)
);
--> statement-breakpoint
ALTER TABLE "workspace_assets" ADD CONSTRAINT "workspace_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_assets" ADD CONSTRAINT "workspace_assets_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_assets_workspace_idx" ON "workspace_assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_assets_created_at_idx" ON "workspace_assets" USING btree ("workspace_id","created_at");