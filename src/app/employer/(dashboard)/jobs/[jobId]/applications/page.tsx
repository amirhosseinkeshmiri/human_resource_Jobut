import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPLICATION_STATUSES,
  applicationStatusLabels,
  parseApplicationStatusFilter,
  type ApplicationStatusFilter,
} from "@/applications/status-policy";
import { getEmployerJobApplicants } from "@/applicants/queries";
import { parseApplicantPage } from "@/applicants/policy";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { jobStatusLabels } from "@/jobs/policy";

export const metadata: Metadata = { title: "درخواست‌های آگهی" };

interface PageProps {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ page?: string | string[]; status?: string | string[] }>;
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
const numberFormatter = new Intl.NumberFormat("fa-IR");

function inboxHref(status: ApplicationStatusFilter, page = 1) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "?";
}

export default async function EmployerJobApplicationsPage({ params, searchParams }: PageProps) {
  const [{ jobId }, query, { company }] = await Promise.all([
    params,
    searchParams,
    getEmployerDashboardContext(),
  ]);
  const statusFilter = parseApplicationStatusFilter(query.status);
  const data = await getEmployerJobApplicants(
    company.id,
    jobId,
    parseApplicantPage(query.page),
    statusFilter,
  );
  if (!data) notFound();

  const filters = [
    { value: "all" as const, label: "همه", count: data.allCount },
    ...APPLICATION_STATUSES.map((status) => ({
      value: status,
      label: applicationStatusLabels[status],
      count: data.statusCounts[status],
    })),
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/employer/jobs/${data.job.id}`} className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
        بازگشت به آگهی
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-meta">درخواست‌های دریافتی</p>
          <h1 className="text-page-title mt-2">{data.job.title}</h1>
          <p className="text-secondary mt-2">{numberFormatter.format(data.allCount)} رزومه ارسال‌شده</p>
        </div>
        <Badge>{jobStatusLabels[data.job.status]}</Badge>
      </div>

      <nav aria-label="فیلتر وضعیت درخواست‌ها" className="mt-7 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={inboxHref(filter.value)}
            aria-current={filter.value === data.statusFilter ? "page" : undefined}
            className={buttonClassNames({
              variant: filter.value === data.statusFilter ? "primary" : "secondary",
              size: "small",
            })}
          >
            {filter.label}
            <span className="text-xs opacity-75">{numberFormatter.format(filter.count)}</span>
          </Link>
        ))}
      </nav>

      {data.applications.length ? (
        <section aria-label="فهرست متقاضیان" className="mt-6 grid gap-3">
          {data.applications.map((application) => (
            <Card key={application.applicationId} className="shadow-none">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-card-title">
                      {application.snapshotAvailable
                        ? `${application.firstName} ${application.lastName}`
                        : "درخواست قدیمی"}
                    </h2>
                    <Badge>{applicationStatusLabels[application.status]}</Badge>
                  </div>
                  {application.snapshotAvailable ? (
                    <>
                      <p className="mt-1 font-semibold text-action">{application.professionalTitle}</p>
                      <p className="text-secondary mt-1">{application.city}</p>
                    </>
                  ) : (
                    <p className="text-secondary mt-2">نسخه تاریخی قابل اتکایی از رزومه این درخواست موجود نیست.</p>
                  )}
                  <p className="text-helper mt-3">ارسال‌شده در {dateFormatter.format(application.createdAt)}</p>
                  {application.skills ? <div className="mt-3 flex flex-wrap gap-2">
                    {application.skills.slice(0, 4).map((skill) => <Badge key={skill}>{skill}</Badge>)}
                    {application.skills.length > 4 ? <Badge>+{numberFormatter.format(application.skills.length - 4)}</Badge> : null}
                  </div> : null}
                </div>
                <Link href={`/employer/jobs/${data.job.id}/applications/${application.applicationId}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "w-full sm:w-auto" })}>
                  مشاهده رزومه
                </Link>
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="mt-6 text-center shadow-none">
          <h2 className="text-card-title">درخواستی با این وضعیت وجود ندارد</h2>
          <p className="text-secondary mt-2">برای مشاهده سایر درخواست‌ها، فیلتر وضعیت را تغییر دهید.</p>
        </Card>
      )}

      <nav aria-label="صفحه‌بندی متقاضیان" className="mt-6 flex items-center justify-between gap-3">
        {data.page > 1 ? <Link href={inboxHref(data.statusFilter, data.page - 1)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}
        <span className="text-sm text-text-secondary">صفحه {numberFormatter.format(data.page)} از {numberFormatter.format(data.pageCount)}</span>
        {data.page < data.pageCount ? <Link href={inboxHref(data.statusFilter, data.page + 1)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : <span />}
      </nav>
    </div>
  );
}
