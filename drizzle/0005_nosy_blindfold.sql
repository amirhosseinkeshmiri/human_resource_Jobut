CREATE TYPE "public"."admin_identifier_type" AS ENUM('email', 'mobile');--> statement-breakpoint
CREATE TABLE "admin_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320),
	"mobile" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_accounts_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "admin_accounts_contact_check" CHECK ("admin_accounts"."email" is not null or "admin_accounts"."mobile" is not null)
);
--> statement-breakpoint
CREATE TABLE "admin_auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(320) NOT NULL,
	"identifier_type" "admin_identifier_type" NOT NULL,
	"code_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_auth_challenges_attempts_check" CHECK ("admin_auth_challenges"."attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_account_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_account_id_admin_accounts_id_fk" FOREIGN KEY ("admin_account_id") REFERENCES "public"."admin_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_auth_challenges_identifier_idx" ON "admin_auth_challenges" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "admin_sessions_account_id_idx" ON "admin_sessions" USING btree ("admin_account_id");