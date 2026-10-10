CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"candidate_resume_id" uuid NOT NULL,
	"job_post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_applications_candidate_job_unique" UNIQUE("candidate_account_id","job_post_id")
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_resume_id_candidate_resumes_id_fk" FOREIGN KEY ("candidate_resume_id") REFERENCES "public"."candidate_resumes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_applications_candidate_id_idx" ON "job_applications" USING btree ("candidate_account_id");--> statement-breakpoint
CREATE INDEX "job_applications_resume_id_idx" ON "job_applications" USING btree ("candidate_resume_id");--> statement-breakpoint
CREATE INDEX "job_applications_job_id_idx" ON "job_applications" USING btree ("job_post_id");