CREATE TABLE "sms_rate_limits" (
	"bucket_key" varchar(100) PRIMARY KEY NOT NULL,
	"request_count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sms_rate_limits_request_count_check" CHECK ("sms_rate_limits"."request_count" > 0),
	CONSTRAINT "sms_rate_limits_window_check" CHECK ("sms_rate_limits"."expires_at" > "sms_rate_limits"."window_started_at")
);
--> statement-breakpoint
CREATE INDEX "sms_rate_limits_expires_at_idx" ON "sms_rate_limits" USING btree ("expires_at");