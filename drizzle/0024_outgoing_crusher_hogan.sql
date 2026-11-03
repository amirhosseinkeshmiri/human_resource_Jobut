CREATE TABLE "candidate_profile_photos" (
	"candidate_account_id" uuid PRIMARY KEY NOT NULL,
	"storage_key" varchar(80) NOT NULL,
	"content_type" varchar(32) DEFAULT 'image/webp' NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profile_photos_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "candidate_profile_photos_storage_key_check" CHECK ("candidate_profile_photos"."storage_key" ~ '^photo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'),
	CONSTRAINT "candidate_profile_photos_content_type_check" CHECK ("candidate_profile_photos"."content_type" = 'image/webp'),
	CONSTRAINT "candidate_profile_photos_byte_size_check" CHECK ("candidate_profile_photos"."byte_size" > 0 and "candidate_profile_photos"."byte_size" <= 1048576)
);
--> statement-breakpoint
ALTER TABLE "candidate_profile_photos" ADD CONSTRAINT "candidate_profile_photos_candidate_account_id_candidate_accounts_id_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."candidate_accounts"("id") ON DELETE cascade ON UPDATE no action;