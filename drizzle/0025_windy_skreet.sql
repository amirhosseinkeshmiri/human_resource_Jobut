CREATE TYPE "public"."candidate_credential_type" AS ENUM('certificate', 'training_course', 'supporting_credential');--> statement-breakpoint
CREATE TABLE "application_resume_snapshot_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"record_type" "candidate_credential_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"issuer" varchar(200) NOT NULL,
	"issue_date" date,
	"expiration_date" date,
	"credential_id" varchar(200),
	"verification_url" text,
	"description" text,
	"sort_order" integer NOT NULL,
	CONSTRAINT "application_resume_snapshot_credentials_sort_unique" UNIQUE("job_application_id","sort_order"),
	CONSTRAINT "application_resume_snapshot_credentials_sort_check" CHECK ("application_resume_snapshot_credentials"."sort_order" >= 0),
	CONSTRAINT "application_resume_snapshot_credentials_dates_check" CHECK ("application_resume_snapshot_credentials"."issue_date" is null or "application_resume_snapshot_credentials"."expiration_date" is null or "application_resume_snapshot_credentials"."expiration_date" >= "application_resume_snapshot_credentials"."issue_date")
);
--> statement-breakpoint
CREATE TABLE "candidate_credential_documents" (
	"credential_id" uuid PRIMARY KEY NOT NULL,
	"storage_key" varchar(88) NOT NULL,
	"content_type" varchar(32) DEFAULT 'image/webp' NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_credential_documents_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "candidate_credential_documents_storage_key_check" CHECK ("candidate_credential_documents"."storage_key" ~ '^credential-[0-9a-f-]{36}\.webp$'),
	CONSTRAINT "candidate_credential_documents_content_type_check" CHECK ("candidate_credential_documents"."content_type" = 'image/webp'),
	CONSTRAINT "candidate_credential_documents_byte_size_check" CHECK ("candidate_credential_documents"."byte_size" > 0 and "candidate_credential_documents"."byte_size" <= 2097152)
);
--> statement-breakpoint
CREATE TABLE "candidate_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"record_type" "candidate_credential_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"issuer" varchar(200) NOT NULL,
	"issue_date" date,
	"expiration_date" date,
	"credential_id" varchar(200),
	"verification_url" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_credentials_dates_check" CHECK ("candidate_credentials"."issue_date" is null or "candidate_credentials"."expiration_date" is null or "candidate_credentials"."expiration_date" >= "candidate_credentials"."issue_date")
);
--> statement-breakpoint
ALTER TABLE "application_resume_snapshot_credentials" ADD CONSTRAINT "application_resume_snapshot_credentials_job_application_id_application_resume_snapshots_job_application_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."application_resume_snapshots"("job_application_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_credential_documents" ADD CONSTRAINT "candidate_credential_documents_credential_id_candidate_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."candidate_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_credentials" ADD CONSTRAINT "candidate_credentials_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_resume_snapshot_credentials_application_idx" ON "application_resume_snapshot_credentials" USING btree ("job_application_id");--> statement-breakpoint
CREATE INDEX "candidate_credentials_candidate_updated_idx" ON "candidate_credentials" USING btree ("candidate_account_id","updated_at");