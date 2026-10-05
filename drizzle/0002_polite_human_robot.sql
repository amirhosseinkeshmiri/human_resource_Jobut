CREATE TYPE "public"."package_purchase_status" AS ENUM('pending', 'paid');--> statement-breakpoint
ALTER TABLE "package_purchases" ADD COLUMN "status" "package_purchase_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "package_purchases" ADD COLUMN "paid_at" timestamp with time zone;