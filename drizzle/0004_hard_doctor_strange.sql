CREATE TYPE "public"."candidate_identifier_type" AS ENUM('email', 'mobile');--> statement-breakpoint
CREATE TABLE "candidate_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320),
	"mobile" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "candidate_accounts_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "candidate_accounts_contact_check" CHECK ("candidate_accounts"."email" is not null or "candidate_accounts"."mobile" is not null)
);
--> statement-breakpoint
CREATE TABLE "candidate_auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(320) NOT NULL,
	"identifier_type" "candidate_identifier_type" NOT NULL,
	"code_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_auth_challenges_attempts_check" CHECK ("candidate_auth_challenges"."attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "candidate_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_sessions_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_auth_challenges_identifier_idx" ON "candidate_auth_challenges" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "candidate_sessions_account_id_idx" ON "candidate_sessions" USING btree ("candidate_account_id");