CREATE TABLE "application_resume_snapshot_educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"field_of_study" varchar(160) NOT NULL,
	"institution_name" varchar(200) NOT NULL,
	"degree" varchar(120) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "application_resume_snapshot_educations_sort_unique" UNIQUE("job_application_id","sort_order"),
	CONSTRAINT "application_resume_snapshot_educations_sort_check" CHECK ("application_resume_snapshot_educations"."sort_order" >= 0),
	CONSTRAINT "application_resume_snapshot_educations_dates_check" CHECK (("application_resume_snapshot_educations"."is_current" = true and "application_resume_snapshot_educations"."end_date" is null) or ("application_resume_snapshot_educations"."is_current" = false and "application_resume_snapshot_educations"."end_date" is not null and "application_resume_snapshot_educations"."end_date" >= "application_resume_snapshot_educations"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "application_resume_snapshot_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"job_title" varchar(160) NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	CONSTRAINT "application_resume_snapshot_experiences_sort_unique" UNIQUE("job_application_id","sort_order"),
	CONSTRAINT "application_resume_snapshot_experiences_sort_check" CHECK ("application_resume_snapshot_experiences"."sort_order" >= 0),
	CONSTRAINT "application_resume_snapshot_experiences_dates_check" CHECK (("application_resume_snapshot_experiences"."is_current" = true and "application_resume_snapshot_experiences"."end_date" is null) or ("application_resume_snapshot_experiences"."is_current" = false and "application_resume_snapshot_experiences"."end_date" is not null and "application_resume_snapshot_experiences"."end_date" >= "application_resume_snapshot_experiences"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "application_resume_snapshot_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"proficiency" "resume_language_proficiency" NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "application_resume_snapshot_languages_sort_unique" UNIQUE("job_application_id","sort_order"),
	CONSTRAINT "application_resume_snapshot_languages_sort_check" CHECK ("application_resume_snapshot_languages"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "application_resume_snapshots" (
	"job_application_id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"city" varchar(160) NOT NULL,
	"professional_title" varchar(160) NOT NULL,
	"professional_summary" text NOT NULL,
	"skills" text[] NOT NULL,
	"linkedin_url" text,
	"portfolio_url" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_applications" DROP CONSTRAINT "job_applications_candidate_resume_id_candidate_resumes_id_fk";
--> statement-breakpoint
ALTER TABLE "job_applications" ALTER COLUMN "candidate_resume_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "application_resume_snapshot_educations" ADD CONSTRAINT "application_resume_snapshot_educations_job_application_id_application_resume_snapshots_job_application_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."application_resume_snapshots"("job_application_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_resume_snapshot_experiences" ADD CONSTRAINT "application_resume_snapshot_experiences_job_application_id_application_resume_snapshots_job_application_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."application_resume_snapshots"("job_application_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_resume_snapshot_languages" ADD CONSTRAINT "application_resume_snapshot_languages_job_application_id_application_resume_snapshots_job_application_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."application_resume_snapshots"("job_application_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_resume_snapshots" ADD CONSTRAINT "application_resume_snapshots_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_resume_snapshot_educations_application_idx" ON "application_resume_snapshot_educations" USING btree ("job_application_id");--> statement-breakpoint
CREATE INDEX "application_resume_snapshot_experiences_application_idx" ON "application_resume_snapshot_experiences" USING btree ("job_application_id");--> statement-breakpoint
CREATE INDEX "application_resume_snapshot_languages_application_idx" ON "application_resume_snapshot_languages" USING btree ("job_application_id");--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_resume_id_candidate_resumes_id_fk" FOREIGN KEY ("candidate_resume_id") REFERENCES "public"."candidate_resumes"("id") ON DELETE set null ON UPDATE no action;