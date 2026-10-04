CREATE TYPE "public"."employer_identifier_type" AS ENUM('email', 'mobile');--> statement-breakpoint
CREATE TABLE "employer_auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(320) NOT NULL,
	"identifier_type" "employer_identifier_type" NOT NULL,
	"code_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_auth_challenges_attempts_check" CHECK ("employer_auth_challenges"."attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "employer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_account_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_sessions_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
ALTER TABLE "employer_sessions" ADD CONSTRAINT "employer_sessions_employer_account_id_employer_accounts_id_fk" FOREIGN KEY ("employer_account_id") REFERENCES "public"."employer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employer_auth_challenges_identifier_idx" ON "employer_auth_challenges" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "employer_sessions_account_id_idx" ON "employer_sessions" USING btree ("employer_account_id");