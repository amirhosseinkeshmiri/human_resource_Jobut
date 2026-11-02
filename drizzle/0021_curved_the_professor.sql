CREATE TABLE "candidate_application_status_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"status_history_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_application_notifications_history_unique" UNIQUE("status_history_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_application_status_notifications" ADD CONSTRAINT "candidate_application_status_notifications_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_application_status_notifications" ADD CONSTRAINT "candidate_application_status_notifications_status_history_id_job_application_status_history_id_fk" FOREIGN KEY ("status_history_id") REFERENCES "public"."job_application_status_history"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_application_notifications_candidate_time_idx" ON "candidate_application_status_notifications" USING btree ("candidate_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "candidate_application_notifications_candidate_read_idx" ON "candidate_application_status_notifications" USING btree ("candidate_account_id","read_at");