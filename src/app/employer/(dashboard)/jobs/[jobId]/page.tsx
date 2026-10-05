import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, FormField, Input, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { updateDraftJob } from "@/jobs/actions";
import { JOB_TITLE_MAX_LENGTH, jobStatusLabels } from "@/jobs/policy";
import { getCompanyJobPost } from "@/jobs/queries";

export const metadata: Metadata = { title: "جزئیات آگهی" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const statusVariants = { draft: "neutral", published: "success", closed: "danger" } as const;

interface JobPageProps {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ created?: string | string[]; updated?: string | string[]; error?: string | string[] }>;
}

export default async function JobPage({ params, searchParams }: JobPageProps) {
  const [{ jobId }, query, { company }] = await Promise.all([params, searchParams, getEmployerDashboardContext()]);
  if (!UUID_PATTERN.test(jobId)) notFound();
  const job = await getCompanyJobPost(company.id, jobId);
  if (!job) notFound();

  const error = typeof query.error === "string" ? query.error : undefined;
  const notice = query.created === "1" ? "پیش‌نویس آگهی ایجاد شد." : query.updated === "1" ? "تغییرات پیش‌نویس ذخیره شد." : null;
  const errorMessage = error === "title"
    ? "عنوان آگهی را به‌درستی وارد کنید."
    : error === "persistence" ? "ذخیره تغییرات انجام نشد. دوباره تلاش کنید." : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-meta">آگهی‌ها</p>
          <h1 className="text-page-title mt-2 break-words">{job.title}</h1>
        </div>
        <Badge variant={statusVariants[job.status]}>{jobStatusLabels[job.status]}</Badge>
      </div>
      {notice ? <p role="status" className="mt-6 rounded-md border border-ui-border bg-surface-elevated p-3 text-sm text-text-secondary">{notice}</p> : null}
      <Card className="mt-8 shadow-none">
        {job.status === "draft" ? (
          <form action={updateDraftJob.bind(null, job.id)} className="grid gap-6">
            <FormField id="job-title" label="عنوان آگهی" required error={errorMessage}>
              <Input name="title" defaultValue={job.title} maxLength={JOB_TITLE_MAX_LENGTH} autoComplete="off" required />
            </FormField>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/employer/jobs" className={buttonClassNames({ variant: "secondary" })}>بازگشت</Link>
              <Button type="submit">ذخیره تغییرات</Button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-secondary">در این مرحله، آگهی‌های منتشرشده یا بسته‌شده فقط قابل مشاهده‌اند.</p>
            <p className="text-helper mt-3">آخرین به‌روزرسانی: {dateFormatter.format(job.updatedAt)}</p>
            <Link href="/employer/jobs" className={buttonClassNames({ variant: "secondary", className: "mt-6" })}>بازگشت به آگهی‌ها</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
