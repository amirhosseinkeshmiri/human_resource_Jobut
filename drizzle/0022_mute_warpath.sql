CREATE TABLE "candidate_saved_jobs" (
	"candidate_account_id" uuid NOT NULL,
	"job_post_id" uuid NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_saved_jobs_pkey" PRIMARY KEY("candidate_account_id","job_post_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_saved_jobs" ADD CONSTRAINT "candidate_saved_jobs_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_saved_jobs" ADD CONSTRAINT "candidate_saved_jobs_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_saved_jobs_candidate_time_idx" ON "candidate_saved_jobs" USING btree ("candidate_account_id","saved_at");--> statement-breakpoint
CREATE INDEX "candidate_saved_jobs_job_post_idx" ON "candidate_saved_jobs" USING btree ("job_post_id");