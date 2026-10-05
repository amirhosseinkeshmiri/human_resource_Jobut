import type { Metadata } from "next";
import Link from "next/link";
import { Card, buttonClassNames } from "@/components/ui";
import { JobPostForm } from "@/components/jobs/job-post-form";
import { createDraftJob } from "@/jobs/actions";

export const metadata: Metadata = { title: "افزودن آگهی جدید" };

interface NewJobPageProps { searchParams: Promise<{ error?: string | string[] }>; }

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = error === "validation"
    ? "اطلاعات آگهی کامل یا معتبر نیست. موارد فرم را بررسی کنید."
    : error === "persistence" ? "ذخیره پیش‌نویس انجام نشد. دوباره تلاش کنید." : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-meta">آگهی‌ها</p>
      <h1 className="text-page-title mt-2">افزودن آگهی جدید</h1>
      <p className="text-secondary mt-3">این آگهی فقط به‌صورت پیش‌نویس ذخیره می‌شود و اعتباری مصرف نمی‌کند.</p>
      <Card className="mt-8 shadow-none">
        <JobPostForm action={createDraftJob} submitLabel="ذخیره پیش‌نویس" serverError={errorMessage} />
      </Card>
      <Link href="/employer/jobs" className={buttonClassNames({ variant: "secondary", className: "mt-4" })}>انصراف</Link>
    </div>
  );
}
