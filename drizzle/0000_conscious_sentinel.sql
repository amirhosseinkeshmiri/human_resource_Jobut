CREATE TYPE "public"."job_post_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benefits_name_unique" UNIQUE("name"),
	CONSTRAINT "benefits_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_account_id" uuid NOT NULL,
	"industry_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"founding_year" integer,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_employer_account_unique" UNIQUE("employer_account_id"),
	CONSTRAINT "companies_founding_year_check" CHECK ("companies"."founding_year" is null or "companies"."founding_year" between 1000 and 9999)
);
--> statement-breakpoint
CREATE TABLE "company_benefits" (
	"company_id" uuid NOT NULL,
	"benefit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_benefits_company_id_benefit_id_pk" PRIMARY KEY("company_id","benefit_id")
);
--> statement-breakpoint
CREATE TABLE "company_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_images_company_sort_unique" UNIQUE("company_id","sort_order"),
	CONSTRAINT "company_images_sort_order_check" CHECK ("company_images"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "company_job_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"package_purchase_id" uuid,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_purchase_unique" UNIQUE("package_purchase_id"),
	CONSTRAINT "credit_transactions_amount_check" CHECK ("company_job_credit_transactions"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "employer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320),
	"mobile" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "employer_accounts_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "employer_accounts_contact_check" CHECK ("employer_accounts"."email" is not null or "employer_accounts"."mobile" is not null)
);
--> statement-breakpoint
CREATE TABLE "industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "industries_name_unique" UNIQUE("name"),
	CONSTRAINT "industries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "job_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"job_credits" integer NOT NULL,
	"price_toman" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_packages_credits_check" CHECK ("job_packages"."job_credits" > 0),
	CONSTRAINT "job_packages_price_check" CHECK ("job_packages"."price_toman" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" "job_post_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_package_id" uuid NOT NULL,
	"package_name" varchar(120) NOT NULL,
	"job_credits" integer NOT NULL,
	"price_toman" integer NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_purchases_credits_check" CHECK ("package_purchases"."job_credits" > 0),
	CONSTRAINT "package_purchases_price_check" CHECK ("package_purchases"."price_toman" >= 0)
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_employer_account_id_employer_accounts_id_fk" FOREIGN KEY ("employer_account_id") REFERENCES "public"."employer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_benefits" ADD CONSTRAINT "company_benefits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_benefits" ADD CONSTRAINT "company_benefits_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_images" ADD CONSTRAINT "company_images_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_job_credit_transactions" ADD CONSTRAINT "company_job_credit_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_job_credit_transactions" ADD CONSTRAINT "company_job_credit_transactions_package_purchase_id_package_purchases_id_fk" FOREIGN KEY ("package_purchase_id") REFERENCES "public"."package_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_job_package_id_job_packages_id_fk" FOREIGN KEY ("job_package_id") REFERENCES "public"."job_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_industry_id_idx" ON "companies" USING btree ("industry_id");--> statement-breakpoint
CREATE INDEX "company_images_company_id_idx" ON "company_images" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_company_id_idx" ON "company_job_credit_transactions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_posts_company_id_idx" ON "job_posts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "package_purchases_company_id_idx" ON "package_purchases" USING btree ("company_id");