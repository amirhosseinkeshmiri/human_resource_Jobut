CREATE TYPE "public"."admin_account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."admin_audit_outcome" AS ENUM('succeeded', 'failed', 'denied');--> statement-breakpoint
CREATE TYPE "public"."admin_permission_code" AS ENUM('admin.dashboard.read', 'admin.employers.read', 'admin.jobs.read', 'admin.sales.read');--> statement-breakpoint
CREATE TABLE "admin_account_permissions" (
	"admin_account_id" uuid NOT NULL,
	"permission_code" "admin_permission_code" NOT NULL,
	"granted_by_admin_account_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_account_permissions_pk" PRIMARY KEY("admin_account_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_account_id" uuid,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" varchar(160),
	"outcome" "admin_audit_outcome" NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_events_action_check" CHECK (char_length(btrim("admin_audit_events"."action")) between 1 and 100),
	CONSTRAINT "admin_audit_events_target_type_check" CHECK (char_length(btrim("admin_audit_events"."target_type")) between 1 and 80),
	CONSTRAINT "admin_audit_events_target_id_check" CHECK ("admin_audit_events"."target_id" is null or char_length(btrim("admin_audit_events"."target_id")) between 1 and 160)
);
--> statement-breakpoint
CREATE TABLE "platform_owner" (
	"singleton_key" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"admin_account_id" uuid NOT NULL,
	"provisioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provisioned_by_reference" varchar(200) NOT NULL,
	CONSTRAINT "platform_owner_admin_account_id_unique" UNIQUE("admin_account_id"),
	CONSTRAINT "platform_owner_singleton_check" CHECK ("platform_owner"."singleton_key" = true),
	CONSTRAINT "platform_owner_reference_check" CHECK (char_length(btrim("platform_owner"."provisioned_by_reference")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN "status" "admin_account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN "disabled_by_admin_account_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN "disable_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "admin_account_permissions" ADD CONSTRAINT "admin_account_permissions_admin_account_id_admin_accounts_id_fk" FOREIGN KEY ("admin_account_id") REFERENCES "public"."admin_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_account_permissions" ADD CONSTRAINT "admin_account_permissions_granted_by_admin_account_id_admin_accounts_id_fk" FOREIGN KEY ("granted_by_admin_account_id") REFERENCES "public"."admin_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_admin_account_id_admin_accounts_id_fk" FOREIGN KEY ("actor_admin_account_id") REFERENCES "public"."admin_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_owner" ADD CONSTRAINT "platform_owner_admin_account_id_admin_accounts_id_fk" FOREIGN KEY ("admin_account_id") REFERENCES "public"."admin_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_account_permissions_permission_idx" ON "admin_account_permissions" USING btree ("permission_code");--> statement-breakpoint
CREATE INDEX "admin_account_permissions_granted_by_idx" ON "admin_account_permissions" USING btree ("granted_by_admin_account_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_time_idx" ON "admin_audit_events" USING btree ("actor_admin_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_action_time_idx" ON "admin_audit_events" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_target_time_idx" ON "admin_audit_events" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_correlation_idx" ON "admin_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_occurred_at_idx" ON "admin_audit_events" USING btree ("occurred_at");--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_disabled_by_fk" FOREIGN KEY ("disabled_by_admin_account_id") REFERENCES "public"."admin_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_status_details_check" CHECK (("admin_accounts"."status" = 'active' and "admin_accounts"."disabled_at" is null and "admin_accounts"."disabled_by_admin_account_id" is null and "admin_accounts"."disable_reason" is null) or ("admin_accounts"."status" = 'disabled' and "admin_accounts"."disabled_at" is not null and "admin_accounts"."disabled_by_admin_account_id" is not null and char_length("admin_accounts"."disable_reason") between 1 and 500));