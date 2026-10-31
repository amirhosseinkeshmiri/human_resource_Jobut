CREATE TABLE "otp_rate_limit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_key" varchar(100) NOT NULL,
	"event_type" varchar(24) DEFAULT 'request' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_rate_limit_events_type_check" CHECK ("otp_rate_limit_events"."event_type" in ('request', 'provider_failure'))
);
--> statement-breakpoint
CREATE INDEX "otp_rate_limit_events_bucket_time_idx" ON "otp_rate_limit_events" USING btree ("bucket_key","occurred_at");--> statement-breakpoint
CREATE INDEX "otp_rate_limit_events_occurred_at_idx" ON "otp_rate_limit_events" USING btree ("occurred_at");