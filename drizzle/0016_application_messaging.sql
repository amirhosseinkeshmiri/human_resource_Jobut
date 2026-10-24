CREATE TYPE "public"."application_message_event_type" AS ENUM('sent', 'read');--> statement-breakpoint
CREATE TYPE "public"."application_message_kind" AS ENUM('recruitment_message', 'interview_invitation');--> statement-breakpoint
CREATE TYPE "public"."application_message_sender_role" AS ENUM('employer', 'candidate');--> statement-breakpoint
CREATE TABLE "application_message_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_message_id" uuid NOT NULL,
	"event_type" "application_message_event_type" NOT NULL,
	"actor_role" "application_message_sender_role" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_message_events_type_unique" UNIQUE("application_message_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "application_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_application_id" uuid NOT NULL,
	"sender_role" "application_message_sender_role" NOT NULL,
	"sender_employer_account_id" uuid,
	"sender_candidate_account_id" uuid,
	"kind" "application_message_kind" DEFAULT 'recruitment_message' NOT NULL,
	"body" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "application_messages_idempotency_unique" UNIQUE("job_application_id","sender_role","idempotency_key"),
	CONSTRAINT "application_messages_body_length_check" CHECK (char_length("application_messages"."body") between 1 and 2000),
	CONSTRAINT "application_messages_sender_check" CHECK (("application_messages"."sender_role" = 'employer' and "application_messages"."sender_employer_account_id" is not null and "application_messages"."sender_candidate_account_id" is null) or ("application_messages"."sender_role" = 'candidate' and "application_messages"."sender_candidate_account_id" is not null and "application_messages"."sender_employer_account_id" is null)),
	CONSTRAINT "application_messages_kind_sender_check" CHECK ("application_messages"."kind" <> 'interview_invitation' or "application_messages"."sender_role" = 'employer'),
	CONSTRAINT "application_messages_read_time_check" CHECK ("application_messages"."read_at" is null or "application_messages"."read_at" >= "application_messages"."created_at")
);
--> statement-breakpoint
ALTER TABLE "application_message_events" ADD CONSTRAINT "application_message_events_application_message_id_application_messages_id_fk" FOREIGN KEY ("application_message_id") REFERENCES "public"."application_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_messages" ADD CONSTRAINT "application_messages_job_application_id_job_applications_id_fk" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_messages" ADD CONSTRAINT "application_messages_sender_employer_account_id_employer_accounts_id_fk" FOREIGN KEY ("sender_employer_account_id") REFERENCES "public"."employer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_messages" ADD CONSTRAINT "application_messages_sender_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("sender_candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_message_events_message_idx" ON "application_message_events" USING btree ("application_message_id","occurred_at");--> statement-breakpoint
CREATE INDEX "application_messages_application_created_idx" ON "application_messages" USING btree ("job_application_id","created_at");