CREATE TABLE "candidate_job_preferences" (
	"candidate_account_id" uuid PRIMARY KEY NOT NULL,
	"preferred_locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_workplace_types" "workplace_type"[] DEFAULT '{}'::workplace_type[] NOT NULL,
	"preferred_employment_types" "employment_type"[] DEFAULT '{}'::employment_type[] NOT NULL,
	"preferred_seniority_levels" "seniority_level"[] DEFAULT '{}'::seniority_level[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_job_preferences_locations_count_check" CHECK (cardinality("candidate_job_preferences"."preferred_locations") <= 5),
	CONSTRAINT "candidate_job_preferences_workplace_count_check" CHECK (cardinality("candidate_job_preferences"."preferred_workplace_types") <= 3),
	CONSTRAINT "candidate_job_preferences_employment_count_check" CHECK (cardinality("candidate_job_preferences"."preferred_employment_types") <= 4),
	CONSTRAINT "candidate_job_preferences_seniority_count_check" CHECK (cardinality("candidate_job_preferences"."preferred_seniority_levels") <= 5)
);
--> statement-breakpoint
ALTER TABLE "candidate_job_preferences" ADD CONSTRAINT "candidate_job_preferences_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE cascade ON UPDATE no action;