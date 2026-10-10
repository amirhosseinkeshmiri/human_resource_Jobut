CREATE TYPE "public"."resume_language_proficiency" AS ENUM('basic', 'intermediate', 'advanced', 'fluent', 'native');--> statement-breakpoint
CREATE TABLE "candidate_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"city" varchar(160) NOT NULL,
	"professional_title" varchar(160) NOT NULL,
	"professional_summary" text NOT NULL,
	"skills" text[] NOT NULL,
	"linkedin_url" text,
	"portfolio_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_resumes_candidate_account_unique" UNIQUE("candidate_account_id")
);
--> statement-breakpoint
CREATE TABLE "resume_educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"field_of_study" varchar(160) NOT NULL,
	"institution_name" varchar(200) NOT NULL,
	"degree" varchar(120) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_educations_resume_sort_unique" UNIQUE("resume_id","sort_order"),
	CONSTRAINT "resume_educations_sort_order_check" CHECK ("resume_educations"."sort_order" >= 0),
	CONSTRAINT "resume_educations_dates_check" CHECK (("resume_educations"."is_current" = true and "resume_educations"."end_date" is null) or ("resume_educations"."is_current" = false and "resume_educations"."end_date" is not null and "resume_educations"."end_date" >= "resume_educations"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "resume_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"job_title" varchar(160) NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_experiences_resume_sort_unique" UNIQUE("resume_id","sort_order"),
	CONSTRAINT "resume_experiences_sort_order_check" CHECK ("resume_experiences"."sort_order" >= 0),
	CONSTRAINT "resume_experiences_dates_check" CHECK (("resume_experiences"."is_current" = true and "resume_experiences"."end_date" is null) or ("resume_experiences"."is_current" = false and "resume_experiences"."end_date" is not null and "resume_experiences"."end_date" >= "resume_experiences"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "resume_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"proficiency" "resume_language_proficiency" NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "resume_languages_resume_sort_unique" UNIQUE("resume_id","sort_order"),
	CONSTRAINT "resume_languages_sort_order_check" CHECK ("resume_languages"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "candidate_resumes" ADD CONSTRAINT "candidate_resumes_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_educations" ADD CONSTRAINT "resume_educations_resume_id_candidate_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."candidate_resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_experiences" ADD CONSTRAINT "resume_experiences_resume_id_candidate_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."candidate_resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_languages" ADD CONSTRAINT "resume_languages_resume_id_candidate_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."candidate_resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_educations_resume_id_idx" ON "resume_educations" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_experiences_resume_id_idx" ON "resume_experiences" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_languages_resume_id_idx" ON "resume_languages" USING btree ("resume_id");