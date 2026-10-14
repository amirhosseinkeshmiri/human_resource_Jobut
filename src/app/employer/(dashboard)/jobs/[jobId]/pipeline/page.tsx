import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPipelineColumns, pipelineApplicationDetailHref } from "@/applicants/pipeline-policy";
import { getEmployerJobPipeline } from "@/applicants/queries";
import { Badge, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { jobStatusLabels } from "@/jobs/policy";

export const metadata: Metadata = { title: "پایپ‌لاین استخدام" };

interface PageProps {
  params: Promise<{ jobId: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const numberFormatter = new Intl.NumberFormat("fa-IR");
const jobStatusVariants = { draft: "neutral", published: "success", closed: "danger" } as const;

export default async function EmployerJobPipelinePage({ params }: PageProps) {
  const [{ jobId }, { company }] = await Promise.all([params, getEmployerDashboardContext()]);
  const pipeline = await getEmployerJobPipeline(company.id, jobId);
  if (!pipeline) notFound();

  const columns = buildPipelineColumns(pipeline.applications, pipeline.counts);

  return (
    <div className="mx-auto max-w-[96rem]">
      <Link href={`/employer/jobs/${pipeline.job.id}`} className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
        بازگشت به مدیریت آگهی
      </Link>
      <header className="mt-5 flex flex-col gap-4 rounded-lg border border-ui-border bg-surface p-[var(--card-padding)] sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-meta">پایپ‌لاین استخدام</p>
          <h1 className="text-page-title mt-2 break-words">{pipeline.job.title}</h1>
          <p className="text-secondary mt-2">{numberFormatter.format(pipeline.total)} درخواست در تمام مراحل</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Badge variant={jobStatusVariants[pipeline.job.status]}>{jobStatusLabels[pipeline.job.status]}</Badge>
          <Link href={`/employer/jobs/${pipeline.job.id}/applications`} className={buttonClassNames({ variant: "secondary", size: "small" })}>
            مشاهده فهرست درخواست‌ها
          </Link>
        </div>
      </header>

      {pipeline.truncated ? (
        <p role="status" className="mt-4 rounded-md border border-ui-border bg-surface-elevated p-3 text-sm text-text-secondary">
          جدیدترین {numberFormatter.format(pipeline.applications.length)} درخواست نمایش داده شده‌اند. برای مشاهده همه درخواست‌ها از فهرست صفحه‌بندی‌شده استفاده کنید.
          {" "}<Link href={`/employer/jobs/${pipeline.job.id}/applications`} className="font-semibold text-action hover:underline">مشاهده فهرست درخواست‌ها</Link>
        </p>
      ) : null}

      <div className="mt-6 overflow-x-visible xl:overflow-x-auto">
        <div className="grid gap-4 md:grid-cols-2 xl:min-w-[90rem] xl:grid-cols-5">
          {columns.map((column) => (
            <section key={column.status} aria-labelledby={`pipeline-${column.status}`} className="rounded-lg border border-ui-border bg-surface-elevated/60 p-3">
              <header className="flex items-center justify-between gap-3 border-b border-ui-border pb-3">
                <h2 id={`pipeline-${column.status}`} className="text-label">{column.label}</h2>
                <Badge aria-label={`${numberFormatter.format(column.count)} درخواست`}>{numberFormatter.format(column.count)}</Badge>
              </header>
              <div className="mt-3 grid gap-3">
                {column.applications.length ? column.applications.map((application) => (
                  <article key={application.applicationId}>
                    <Link
                      href={pipelineApplicationDetailHref(pipeline.job.id, application.applicationId)}
                      className="block min-h-11 rounded-md border border-ui-border bg-surface p-3 outline-none transition-colors hover:border-action/30 hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-focus/30"
                      aria-label={`مشاهده درخواست ${application.firstName} ${application.lastName}`}
                    >
                      <h3 className="text-sm font-bold text-text-primary">{application.firstName} {application.lastName}</h3>
                      <p className="mt-1 text-sm font-semibold text-action">{application.professionalTitle}</p>
                      <p className="text-helper mt-1">{application.city}</p>
                      <p className="text-helper mt-3">ارسال‌شده در {dateFormatter.format(application.createdAt)}</p>
                      {application.skills.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="مهارت‌های منتخب">
                          {application.skills.slice(0, 3).map((skill) => <Badge key={skill}>{skill}</Badge>)}
                          {application.skills.length > 3 ? <Badge>+{numberFormatter.format(application.skills.length - 3)}</Badge> : null}
                        </div>
                      ) : null}
                    </Link>
                  </article>
                )) : (
                  <p className="rounded-md border border-dashed border-ui-border p-4 text-center text-sm text-text-muted">
                    {column.count > 0 ? "درخواست‌های قدیمی‌تر در فهرست کامل هستند." : "درخواستی در این مرحله نیست."}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
