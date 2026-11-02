CREATE TYPE "public"."candidate_data_request_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."candidate_data_request_type" AS ENUM('personal_data_export', 'account_deletion');--> statement-breakpoint
CREATE TABLE "candidate_data_request_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" "candidate_data_request_status",
	"to_status" "candidate_data_request_status" NOT NULL,
	"source" varchar(32) DEFAULT 'candidate' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_data_request_events_source_check" CHECK ("candidate_data_request_status_events"."source" in ('candidate', 'operator', 'system'))
);
--> statement-breakpoint
CREATE TABLE "candidate_data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"request_type" "candidate_data_request_type" NOT NULL,
	"status" "candidate_data_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "candidate_data_requests_resolution_check" CHECK (("candidate_data_requests"."status" in ('pending', 'in_progress') and "candidate_data_requests"."resolved_at" is null) or ("candidate_data_requests"."status" in ('completed', 'rejected', 'cancelled') and "candidate_data_requests"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "candidate_data_request_status_events" ADD CONSTRAINT "candidate_data_request_status_events_request_id_candidate_data_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."candidate_data_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_data_requests" ADD CONSTRAINT "candidate_data_requests_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_data_request_events_request_time_idx" ON "candidate_data_request_status_events" USING btree ("request_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_data_requests_active_type_unique" ON "candidate_data_requests" USING btree ("candidate_account_id","request_type") WHERE "candidate_data_requests"."status" in ('pending', 'in_progress');--> statement-breakpoint
CREATE INDEX "candidate_data_requests_candidate_created_idx" ON "candidate_data_requests" USING btree ("candidate_account_id","created_at");