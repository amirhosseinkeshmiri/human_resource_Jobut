CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'project', 'internship');--> statement-breakpoint
CREATE TYPE "public"."seniority_level" AS ENUM('intern', 'junior', 'mid_level', 'senior', 'lead');--> statement-breakpoint
CREATE TYPE "public"."workplace_type" AS ENUM('onsite', 'remote', 'hybrid');--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "workplace_type" "workplace_type";--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "employment_type" "employment_type";--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "location" varchar(160);--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "seniority_level" "seniority_level";--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "salary_min" integer;--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "salary_max" integer;--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "salary_negotiable" boolean;--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "required_skills" text[];--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_posts" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_salary_check" CHECK (("job_posts"."salary_min" is null or "job_posts"."salary_min" >= 0) and ("job_posts"."salary_max" is null or "job_posts"."salary_max" >= 0) and ("job_posts"."salary_min" is null or "job_posts"."salary_max" is null or "job_posts"."salary_max" >= "job_posts"."salary_min"));