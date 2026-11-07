ALTER TABLE "job_packages" ADD COLUMN "display_order" integer;--> statement-breakpoint
ALTER TABLE "job_packages" ADD COLUMN "display_validity_text" varchar(120);--> statement-breakpoint
ALTER TABLE "job_packages" ADD COLUMN "payment_description" varchar(240);--> statement-breakpoint
ALTER TABLE "job_packages" ADD COLUMN "online_checkout_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "job_packages" ADD CONSTRAINT "job_packages_display_order_check" CHECK ("job_packages"."display_order" is null or "job_packages"."display_order" >= 0);--> statement-breakpoint
ALTER TABLE "job_packages" ADD CONSTRAINT "job_packages_display_validity_check" CHECK ("job_packages"."display_validity_text" is null or char_length(btrim("job_packages"."display_validity_text")) between 1 and 120);--> statement-breakpoint
ALTER TABLE "job_packages" ADD CONSTRAINT "job_packages_payment_description_check" CHECK ("job_packages"."payment_description" is null or char_length(btrim("job_packages"."payment_description")) between 1 and 240);