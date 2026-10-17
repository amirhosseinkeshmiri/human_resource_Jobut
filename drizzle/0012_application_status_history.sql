CREATE TABLE "job_application_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"from_status" "application_status" NOT NULL,
	"to_status" "application_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_application_status_history" ADD CONSTRAINT "job_application_status_history_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_application_status_history_application_changed_idx" ON "job_application_status_history" USING btree ("job_application_id","changed_at");
--> NOTICE:  identifier "job_application_status_history_job_application_id_job_applications_id_fk" will be truncated to "job_application_status_history_job_application_id_job_applicati"
--> CREATE INDEX