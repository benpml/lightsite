ALTER TABLE "webhook_automations" ADD CONSTRAINT "webhook_automations_current_revision_check" CHECK ("webhook_automations"."current_revision_id" is not null);--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_response_status_check" CHECK ("webhook_deliveries"."response_status" is null or "webhook_deliveries"."response_status" between 100 and 599);--> statement-breakpoint
ALTER TABLE "webhook_messages" ADD CONSTRAINT "webhook_messages_payload_pair_check" CHECK (("webhook_messages"."payload" is null) = ("webhook_messages"."payload_text" is null));--> statement-breakpoint
ALTER TABLE "webhook_messages" ADD CONSTRAINT "webhook_messages_payload_size_check" CHECK ("webhook_messages"."payload_text" is null or octet_length("webhook_messages"."payload_text") <= 16384);--> statement-breakpoint
ALTER TABLE "webhook_messages" ADD CONSTRAINT "webhook_messages_event_type_check" CHECK ("webhook_messages"."event_type" in ('site_visit', 'button_click', 'link_click', 'tab_switch'));
--> statement-breakpoint
ALTER TABLE "webhook_automations" ADD CONSTRAINT "webhook_automations_current_revision_fk" FOREIGN KEY ("id", "current_revision_id") REFERENCES "public"."webhook_automation_revisions"("automation_id", "id") ON DELETE no action DEFERRABLE INITIALLY DEFERRED;
