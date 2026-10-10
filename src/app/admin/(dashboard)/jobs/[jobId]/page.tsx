import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminJobDetail } from "@/admin/jobs";
import { adminJobPresentationLabels, getAdminJobPresentationStatus, type AdminJobPresentationStatus } from "@/admin/jobs-policy";
import { requireAdmin } from "@/admin-auth/session";
import { Badge, Card, buttonClassNames, type BadgeProps } from "@/components/ui";
import { sanitizeJobDescription } from "@/jobs/description";
import { formatJobSalary } from "@/jobs/public-policy";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";

export const metadata: Metadata = { title: "جزئیات آگهی" };

interface PageProps { params: Promise<{ jobId: string }>; }

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
const badgeVariants: Record<AdminJobPresentationStatus, BadgeProps["variant"]> = { draft: "neutral", published_active: "success", published_expired: "warning", published_incomplete: "neutral", closed: "danger" };

export default async function AdminJobDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { jobId } = await params;
  const job = await getAdminJobDetail(jobId);
  if (!job) notFound();
  const displayStatus = getAdminJobPresentationStatus(job);

  return (
    <div>
      <Link href="/admin/jobs" className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">بازگشت به آگهی‌ها</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-meta">جزئیات آگهی</p><h1 className="text-page-title mt-2">{job.title}</h1><p className="text-secondary mt-2">شرکت <Link href={`/admin/employers/${job.companyId}`} className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{job.companyName}</Link> · {job.industryName}</p></div><Badge variant={badgeVariants[displayStatus]}>{adminJobPresentationLabels[displayStatus]}</Badge></div>

      {displayStatus === "published_incomplete" ? <Card className="mt-6 border-warning/30 bg-warning/5 shadow-none"><p className="font-semibold text-warning">اطلاعات زمان‌بندی انتشار این رکورد تاریخی ناقص است.</p><p className="text-secondary mt-2">این وضعیت فقط برای بررسی مدیریت نمایش داده می‌شود و تغییری در رکورد ایجاد نمی‌کند.</p></Card> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid gap-6"><Card className="shadow-none"><h2 className="text-section-title">توضیحات شغل</h2>{job.description ? <div className="text-body mt-5 grid gap-3 text-text-secondary [&_ol]:list-decimal [&_ol]:pe-6 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pe-6" dangerouslySetInnerHTML={{ __html: sanitizeJobDescription(job.description) }} /> : <p className="text-secondary mt-4">توضیحی ثبت نشده است.</p>}</Card><Card className="shadow-none"><h2 className="text-card-title">مهارت‌های موردنیاز</h2>{job.requiredSkills?.length ? <div className="mt-4 flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div> : <p className="text-secondary mt-4">مهارتی ثبت نشده است.</p>}</Card></div>
        <aside className="grid gap-4" aria-label="مشخصات آگهی"><Card className="shadow-none"><h2 className="text-card-title">مشخصات موقعیت</h2><dl className="mt-5 grid gap-4 text-sm"><div><dt className="text-meta">شهر</dt><dd className="mt-1 font-semibold">{job.location ?? "—"}</dd></div><div><dt className="text-meta">نوع حضور</dt><dd className="mt-1 font-semibold">{job.workplaceType ? workplaceTypeLabels[job.workplaceType] : "—"}</dd></div><div><dt className="text-meta">نوع همکاری</dt><dd className="mt-1 font-semibold">{job.employmentType ? employmentTypeLabels[job.employmentType] : "—"}</dd></div><div><dt className="text-meta">سطح ارشدیت</dt><dd className="mt-1 font-semibold">{job.seniorityLevel ? seniorityLevelLabels[job.seniorityLevel] : "—"}</dd></div><div><dt className="text-meta">حقوق</dt><dd className="mt-1 font-semibold">{formatJobSalary(job)}</dd></div></dl></Card>
          <Card className="shadow-none"><h2 className="text-card-title">زمان‌بندی</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-meta">ایجاد</dt><dd className="mt-1">{dateFormatter.format(job.createdAt)}</dd></div><div><dt className="text-meta">آخرین به‌روزرسانی</dt><dd className="mt-1">{dateFormatter.format(job.updatedAt)}</dd></div><div><dt className="text-meta">انتشار</dt><dd className="mt-1">{job.publishedAt ? dateFormatter.format(job.publishedAt) : "—"}</dd></div><div><dt className="text-meta">انقضا</dt><dd className="mt-1">{job.expiresAt ? dateFormatter.format(job.expiresAt) : "—"}</dd></div></dl></Card>
          <Link href={`/admin/employers/${job.companyId}`} className={buttonClassNames({ variant: "secondary", className: "w-full" })}>مشاهده شرکت</Link></aside>
      </div>
    </div>
  );
}
