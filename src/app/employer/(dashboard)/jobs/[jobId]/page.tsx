import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, buttonClassNames } from "@/components/ui";
import { JobPostForm } from "@/components/jobs/job-post-form";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { getJobApplicationCount } from "@/applicants/queries";
import { getRemainingJobCredits } from "@/dashboard/metrics";
import { publishDraftJob, updateDraftJob } from "@/jobs/actions";
import { jobStatusLabels } from "@/jobs/policy";
import { getCompanyJobPost } from "@/jobs/queries";
import { sanitizeJobDescription } from "@/jobs/description";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";

export const metadata: Metadata = { title: "جزئیات آگهی" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const statusVariants = { draft: "neutral", published: "success", closed: "danger" } as const;

interface JobPageProps {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{
    created?: string | string[];
    updated?: string | string[];
    published?: string | string[];
    publish?: string | string[];
    error?: string | string[];
  }>;
}

export default async function JobPage({ params, searchParams }: JobPageProps) {
  const [{ jobId }, query, { company }] = await Promise.all([params, searchParams, getEmployerDashboardContext()]);
  if (!UUID_PATTERN.test(jobId)) notFound();
  const [job, remainingJobCredits, applicationCount] = await Promise.all([
    getCompanyJobPost(company.id, jobId),
    getRemainingJobCredits(company.id),
    getJobApplicationCount(company.id, jobId),
  ]);
  if (!job) notFound();

  const error = typeof query.error === "string" ? query.error : undefined;
  const notice = query.published === "1"
    ? "آگهی با موفقیت منتشر شد و یک اعتبار آگهی مصرف شد."
    : query.created === "1"
      ? "پیش‌نویس آگهی ایجاد شد."
      : query.updated === "1"
        ? "تغییرات پیش‌نویس ذخیره شد."
        : null;
  const publishState = typeof query.publish === "string" ? query.publish : undefined;
  const publishError = publishState === "insufficient"
    ? "اعتبار کافی برای انتشار آگهی ندارید."
    : publishState === "incomplete"
      ? "برای انتشار، ابتدا همه اطلاعات ضروری آگهی را کامل و ذخیره کنید."
    : publishState === "not-draft"
      ? "این آگهی دیگر قابل انتشار نیست."
      : publishState === "error"
        ? "انتشار آگهی انجام نشد. دوباره تلاش کنید."
        : null;
  const errorMessage = error === "validation"
    ? "اطلاعات آگهی کامل یا معتبر نیست. موارد فرم را بررسی کنید."
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
      {publishError ? <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{publishError}</p> : null}
      <Card className="mt-8 shadow-none">
        {job.status === "draft" ? (
          <JobPostForm
            action={updateDraftJob.bind(null, job.id)}
            submitLabel="ذخیره تغییرات"
            serverError={errorMessage}
            initialValues={{ ...job, description: sanitizeJobDescription(job.description) }}
          />
        ) : (
          <div className="grid gap-6">
            <p className="text-secondary">آگهی‌های منتشرشده یا بسته‌شده فقط قابل مشاهده‌اند.</p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-meta">نوع حضور</dt><dd className="text-label mt-1">{job.workplaceType ? workplaceTypeLabels[job.workplaceType] : "—"}</dd></div>
              <div><dt className="text-meta">نوع همکاری</dt><dd className="text-label mt-1">{job.employmentType ? employmentTypeLabels[job.employmentType] : "—"}</dd></div>
              <div><dt className="text-meta">شهر</dt><dd className="text-label mt-1">{job.location || "—"}</dd></div>
              <div><dt className="text-meta">سطح ارشدیت</dt><dd className="text-label mt-1">{job.seniorityLevel ? seniorityLevelLabels[job.seniorityLevel] : "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-meta">بازه حقوق</dt><dd className="text-label mt-1">{job.salaryNegotiable ? "حقوق توافقی" : job.salaryMin !== null && job.salaryMax !== null ? `${job.salaryMin.toLocaleString("fa-IR")} تا ${job.salaryMax.toLocaleString("fa-IR")} تومان` : "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-meta">مهارت‌های کلیدی</dt><dd className="mt-2 flex flex-wrap gap-2">{job.requiredSkills?.map((skill) => <Badge key={skill}>{skill}</Badge>) ?? "—"}</dd></div>
            </dl>
            <div>
              <h2 className="text-label">توضیحات شغل</h2>
              {job.description ? <div className="text-secondary mt-2 grid gap-3 [&_ol]:list-decimal [&_ol]:pe-6 [&_ul]:list-disc [&_ul]:pe-6" dangerouslySetInnerHTML={{ __html: sanitizeJobDescription(job.description) }} /> : <p className="text-secondary mt-2">—</p>}
            </div>
            <p className="text-helper">آخرین به‌روزرسانی: {dateFormatter.format(job.updatedAt)}</p>
            <Link href="/employer/jobs" className={buttonClassNames({ variant: "secondary", className: "mt-6" })}>بازگشت به آگهی‌ها</Link>
          </div>
        )}
      </Card>
      <Card className="mt-4 shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-card-title">رزومه‌های دریافتی</h2><p className="text-secondary mt-2">{applicationCount.toLocaleString("fa-IR")} درخواست برای این آگهی</p></div>{applicationCount > 0 ? <Link href={`/employer/jobs/${job.id}/applications`} className={buttonClassNames({ variant: "secondary", className: "w-full sm:w-auto" })}>مشاهده درخواست‌ها</Link> : null}</div>
      </Card>
      {job.status === "draft" ? (
        <Card className="mt-4 shadow-none">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-card-title">انتشار آگهی</h2>
              <p className="text-secondary mt-2">انتشار این پیش‌نویس، ۱ اعتبار آگهی مصرف می‌کند.</p>
              <p className="text-helper mt-1">اعتبار فعلی: {remainingJobCredits.toLocaleString("fa-IR")}</p>
            </div>
            {remainingJobCredits >= 1 ? (
              <form action={publishDraftJob.bind(null, job.id)}>
                <Button type="submit" className="w-full sm:w-auto">انتشار آگهی</Button>
              </form>
            ) : (
              <div className="flex flex-col gap-2 sm:items-end">
                <Button type="button" disabled className="w-full sm:w-auto">انتشار آگهی</Button>
                <Link href="/employer/packages" className="text-sm font-semibold text-action hover:text-action-hover">مشاهده بسته‌ها</Link>
              </div>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
