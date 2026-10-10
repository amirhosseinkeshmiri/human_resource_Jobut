import type { Metadata } from "next";
import Link from "next/link";
import { getAdminJobs } from "@/admin/jobs";
import {
  adminJobPresentationLabels,
  getAdminJobPresentationStatus,
  parseAdminJobParams,
  type AdminJobFilter,
  type AdminJobPresentationStatus,
  type AdminJobSort,
} from "@/admin/jobs-policy";
import { requireAdmin } from "@/admin-auth/session";
import { Badge, Card, Input, Label, Select, buttonClassNames, type BadgeProps } from "@/components/ui";
import { employmentTypeLabels, workplaceTypeLabels } from "@/jobs/validation";

export const metadata: Metadata = { title: "مدیریت آگهی‌ها" };

interface PageProps {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[]; sort?: string | string[]; page?: string | string[] }>;
}

const filterLabels: Record<AdminJobFilter, string> = {
  all: "همه وضعیت‌ها",
  draft: "پیش‌نویس",
  published_active: "منتشرشده فعال",
  published_expired: "منتشرشده منقضی‌شده",
  closed: "بسته‌شده",
};
const sortLabels: Record<AdminJobSort, string> = {
  created_desc: "جدیدترین ایجاد",
  created_asc: "قدیمی‌ترین ایجاد",
  published_desc: "جدیدترین انتشار",
  published_asc: "قدیمی‌ترین انتشار",
  expires_asc: "نزدیک‌ترین انقضا",
  expires_desc: "دورترین انقضا",
};
const badgeVariants: Record<AdminJobPresentationStatus, BadgeProps["variant"]> = {
  draft: "neutral",
  published_active: "success",
  published_expired: "warning",
  published_incomplete: "neutral",
  closed: "danger",
};
const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function jobsHref(page: number, params: ReturnType<typeof parseAdminJobParams>) {
  const query = new URLSearchParams({ page: String(page), status: params.status, sort: params.sort });
  if (params.query) query.set("q", params.query);
  return `/admin/jobs?${query.toString()}`;
}

export default async function AdminJobsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = parseAdminJobParams(await searchParams);
  const data = await getAdminJobs(params);

  return (
    <div>
      <div><p className="text-meta">نمای عملیاتی خواندنی</p><h1 className="text-page-title mt-2">آگهی‌ها</h1><p className="text-secondary mt-3">بررسی آگهی‌های همه شرکت‌ها و وضعیت انتشار آن‌ها.</p></div>

      <Card className="mt-8 shadow-none"><form method="get" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,0.35fr)_minmax(12rem,0.4fr)_auto] lg:items-end">
        <div><Label htmlFor="job-search">جست‌وجو</Label><Input id="job-search" name="q" defaultValue={params.query} placeholder="عنوان شغل یا نام شرکت" className="mt-2" /></div>
        <div><Label htmlFor="job-status">وضعیت</Label><Select id="job-status" name="status" defaultValue={params.status} className="mt-2">{Object.entries(filterLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
        <div><Label htmlFor="job-sort">مرتب‌سازی</Label><Select id="job-sort" name="sort" defaultValue={params.sort} className="mt-2">{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
        <button type="submit" className={buttonClassNames({ className: "w-full lg:w-auto" })}>اعمال</button>
      </form></Card>

      <div className="mt-5 flex items-center justify-between gap-3"><p className="text-secondary">{numberFormatter.format(data.total)} آگهی</p>{params.query || params.status !== "all" ? <Link href="/admin/jobs" className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">پاک‌کردن فیلترها</Link> : null}</div>

      {data.items.length ? <>
        <div className="mt-4 grid gap-3 lg:hidden">{data.items.map((job) => {
          const displayStatus = getAdminJobPresentationStatus(job, data.now);
          return <Card key={job.id} className="shadow-none"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-bold">{job.title}</h2><Link href={`/admin/employers/${job.companyId}`} className="text-helper mt-1 block font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{job.companyName}</Link></div><Badge variant={badgeVariants[displayStatus]}>{adminJobPresentationLabels[displayStatus]}</Badge></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-meta">شهر</dt><dd className="mt-1 font-semibold">{job.location ?? "—"}</dd></div><div><dt className="text-meta">نوع حضور</dt><dd className="mt-1 font-semibold">{job.workplaceType ? workplaceTypeLabels[job.workplaceType] : "—"}</dd></div><div><dt className="text-meta">نوع همکاری</dt><dd className="mt-1 font-semibold">{job.employmentType ? employmentTypeLabels[job.employmentType] : "—"}</dd></div><div><dt className="text-meta">تاریخ ایجاد</dt><dd className="mt-1">{dateFormatter.format(job.createdAt)}</dd></div><div><dt className="text-meta">انتشار</dt><dd className="mt-1">{job.publishedAt ? dateFormatter.format(job.publishedAt) : "—"}</dd></div><div><dt className="text-meta">انقضا</dt><dd className="mt-1">{job.expiresAt ? dateFormatter.format(job.expiresAt) : "—"}</dd></div></dl><Link href={`/admin/jobs/${job.id}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "mt-5 w-full" })}>مشاهده آگهی</Link></Card>;
        })}</div>
        <div className="mt-4 hidden overflow-hidden rounded-lg border border-ui-border bg-surface lg:block"><table className="w-full table-fixed text-right text-sm"><thead className="bg-surface-elevated text-text-secondary"><tr><th className="w-[18%] px-3 py-3">عنوان شغلی</th><th className="w-[13%] px-3 py-3">شرکت</th><th className="w-[11%] px-3 py-3">وضعیت</th><th className="w-[9%] px-3 py-3">شهر</th><th className="w-[9%] px-3 py-3">حضور</th><th className="w-[10%] px-3 py-3">همکاری</th><th className="w-[10%] px-3 py-3">ایجاد</th><th className="w-[10%] px-3 py-3">انتشار</th><th className="w-[10%] px-3 py-3">انقضا</th></tr></thead><tbody className="divide-y divide-ui-border">{data.items.map((job) => {
          const displayStatus = getAdminJobPresentationStatus(job, data.now);
          return <tr key={job.id} className="align-top"><td className="px-3 py-4"><Link href={`/admin/jobs/${job.id}`} className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{job.title}</Link></td><td className="px-3 py-4"><Link href={`/admin/employers/${job.companyId}`} className="text-text-secondary outline-none hover:text-action hover:underline focus-visible:ring-2 focus-visible:ring-focus">{job.companyName}</Link></td><td className="px-3 py-4"><Badge variant={badgeVariants[displayStatus]}>{adminJobPresentationLabels[displayStatus]}</Badge></td><td className="px-3 py-4">{job.location ?? "—"}</td><td className="px-3 py-4">{job.workplaceType ? workplaceTypeLabels[job.workplaceType] : "—"}</td><td className="px-3 py-4">{job.employmentType ? employmentTypeLabels[job.employmentType] : "—"}</td><td className="px-3 py-4 text-text-secondary">{dateFormatter.format(job.createdAt)}</td><td className="px-3 py-4 text-text-secondary">{job.publishedAt ? dateFormatter.format(job.publishedAt) : "—"}</td><td className="px-3 py-4 text-text-secondary">{job.expiresAt ? dateFormatter.format(job.expiresAt) : "—"}</td></tr>;
        })}</tbody></table></div>
      </> : <Card className="mt-4 text-center shadow-none"><p className="text-card-title">آگهی‌ای پیدا نشد</p><p className="text-secondary mt-2">عبارت جست‌وجو یا فیلتر انتخاب‌شده را بررسی کنید.</p></Card>}

      <nav aria-label="صفحه‌بندی آگهی‌ها" className="mt-6 flex items-center justify-between gap-3">{data.page > 1 ? <Link href={jobsHref(data.page - 1, params)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}<span className="text-sm text-text-secondary">صفحه {numberFormatter.format(data.page)} از {numberFormatter.format(data.pageCount)}</span>{data.page < data.pageCount ? <Link href={jobsHref(data.page + 1, params)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : <span />}</nav>
    </div>
  );
}
