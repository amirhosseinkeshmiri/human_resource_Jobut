CREATE TYPE "public"."payment_attempt_status" AS ENUM('created', 'redirect_ready', 'verified', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_purchase_id" uuid NOT NULL,
	"provider" varchar(16) DEFAULT 'SEP' NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'created' NOT NULL,
	"amount_rial" bigint NOT NULL,
	"res_num" varchar(80) NOT NULL,
	"ref_num" varchar(160),
	"gateway_state" varchar(80),
	"failure_category" varchar(80),
	"verified_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_res_num_unique" UNIQUE("res_num"),
	CONSTRAINT "payment_attempts_ref_num_unique" UNIQUE("ref_num"),
	CONSTRAINT "payment_attempts_provider_check" CHECK ("payment_attempts"."provider" = 'SEP'),
	CONSTRAINT "payment_attempts_amount_check" CHECK ("payment_attempts"."amount_rial" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_package_purchase_id_package_purchases_id_fk" FOREIGN KEY ("package_purchase_id") REFERENCES "public"."package_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_attempts_purchase_id_idx" ON "payment_attempts" USING btree ("package_purchase_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_active_idx" ON "payment_attempts" USING btree ("package_purchase_id","status","created_at");