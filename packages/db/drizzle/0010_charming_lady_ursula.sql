CREATE TABLE "site_collaboration_documents" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"state" "bytea" NOT NULL,
	"updated_by_user_id" varchar(191),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_collaboration_documents" ADD CONSTRAINT "site_collaboration_documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaboration_documents" ADD CONSTRAINT "site_collaboration_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_collaboration_workspace_updated_at_idx" ON "site_collaboration_documents" USING btree ("workspace_id","updated_at");