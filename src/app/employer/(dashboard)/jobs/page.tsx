import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { getRemainingJobCredits } from "@/dashboard/metrics";
import { jobStatusLabels } from "@/jobs/policy";
import { getCompanyJobPosts } from "@/jobs/queries";

export const metadata: Metadata = { title: "مدیریت آگهی‌ها" };

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const statusVariants = { draft: "neutral", published: "success", closed: "danger" } as const;

export default async function EmployerJobsPage() {
  const { company } = await getEmployerDashboardContext();
  const [remainingJobCredits, jobs] = await Promise.all([
    getRemainingJobCredits(company.id),
    getCompanyJobPosts(company.id),
  ]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-meta">آگهی‌ها</p>
          <h1 className="text-page-title mt-2">مدیریت آگهی‌ها</h1>
          <p className="text-secondary mt-3">فهرست آگهی‌های ثبت‌شده برای شرکت شما.</p>
        </div>
        <Link href="/employer/jobs/new" className={buttonClassNames({ className: "w-full sm:w-auto" })}>افزودن آگهی جدید</Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <Card className="shadow-none">
          <p className="text-label">اعتبار آگهی باقی‌مانده</p>
          <p className="mt-4 text-3xl font-bold">{numberFormatter.format(remainingJobCredits)}</p>
          <p className="text-helper mt-2">ساخت و ویرایش پیش‌نویس رایگان است.</p>
        </Card>

        {jobs.length > 0 ? (
          <section aria-labelledby="company-jobs-title" className="grid gap-3">
            <h2 id="company-jobs-title" className="sr-only">آگهی‌های شرکت</h2>
            {jobs.map((job) => (
              <Card key={job.id} className="grid gap-4 shadow-none sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-card-title break-words">{job.title}</h3>
                    <Badge variant={statusVariants[job.status]}>{jobStatusLabels[job.status]}</Badge>
                  </div>
                  <p className="text-helper mt-2">
                    آخرین به‌روزرسانی: <time dateTime={job.updatedAt.toISOString()}>{dateFormatter.format(job.updatedAt)}</time>
                  </p>
                </div>
                <Link href={`/employer/jobs/${job.id}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "w-full sm:w-auto" })}>
                  {job.status === "draft" ? "ویرایش" : "مشاهده"}
                </Link>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="text-center shadow-none">
            <h2 className="text-card-title">هنوز آگهی‌ای ثبت نشده است</h2>
            <p className="text-secondary mx-auto mt-2 max-w-xl">نخستین آگهی را به‌صورت پیش‌نویس ایجاد کنید.</p>
            <Link href="/employer/jobs/new" className={buttonClassNames({ className: "mt-5" })}>افزودن آگهی جدید</Link>
          </Card>
        )}
      </div>
    </div>
  );
}
