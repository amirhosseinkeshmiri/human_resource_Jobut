CREATE TABLE "candidate_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_account_id" uuid NOT NULL,
	"terms_version" varchar(64) NOT NULL,
	"privacy_version" varchar(64) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_legal_acceptances_versions_unique" UNIQUE("candidate_account_id","terms_version","privacy_version")
);
--> statement-breakpoint
ALTER TABLE "candidate_legal_acceptances" ADD CONSTRAINT "candidate_legal_acceptances_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_legal_acceptances_candidate_time_idx" ON "candidate_legal_acceptances" USING btree ("candidate_account_id","accepted_at");