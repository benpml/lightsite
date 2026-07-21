CREATE TABLE "user_profile_image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_image_assets_size_check" CHECK ("user_profile_image_assets"."byte_size" between 1 and 1048576),
	CONSTRAINT "user_profile_image_assets_square_check" CHECK ("user_profile_image_assets"."width" = "user_profile_image_assets"."height")
);
--> statement-breakpoint
ALTER TABLE "user_profile_image_assets" ADD CONSTRAINT "user_profile_image_assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_profile_image_assets_user_idx" ON "user_profile_image_assets" USING btree ("user_id");