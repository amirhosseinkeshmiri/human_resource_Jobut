import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminEmployerDetail } from "@/admin/employers";
import { requireAdmin } from "@/admin-auth/session";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { jobStatusLabels, type JobStatus } from "@/jobs/policy";

export const metadata: Metadata = { title: "جزئیات کارفرما" };

interface PageProps { params: Promise<{ companyId: string }>; }

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const purchaseStatus = { paid: "پرداخت‌شده", pending: "در انتظار پرداخت" } as const;

export default async function AdminEmployerDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { companyId } = await params;
  const detail = await getAdminEmployerDetail(companyId);
  if (!detail) notFound();

  const { company, jobs, purchases, credits, recentJobs, recentPurchases, recentCredits } = detail;

  return (
    <div>
      <Link href="/admin/employers" className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">بازگشت به کارفرماها</Link>
      <div className="mt-5 flex items-start gap-4">
        <CompanyLogo companyName={company.name} logoUrl={company.logoUrl} size="large" />
        <div className="min-w-0"><p className="text-meta">جزئیات شرکت</p><h1 className="text-page-title mt-1">{company.name}</h1><p className="text-secondary mt-2">{company.industryName}</p></div>
      </div>

      <section aria-label="خلاصه آماری" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none"><p className="text-meta">کل آگهی‌ها</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(jobs.total)}</p></Card>
        <Card className="shadow-none"><p className="text-meta">آگهی منتشرشده</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(jobs.published)}</p></Card>
        <Card className="shadow-none"><p className="text-meta">مانده اعتبار</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(credits.balance)}</p></Card>
        <Card className="shadow-none"><p className="text-meta">خرید پرداخت‌شده</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(purchases.paidAmount)} تومان</p></Card>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="shadow-none"><h2 className="text-card-title">اطلاعات شرکت</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-meta">نام شرکت</dt><dd className="text-label mt-1">{company.name}</dd></div><div><dt className="text-meta">صنعت</dt><dd className="text-label mt-1">{company.industryName}</dd></div><div><dt className="text-meta">سال تأسیس</dt><dd className="text-label mt-1">{company.foundingYear ? numberFormatter.format(company.foundingYear) : "—"}</dd></div><div><dt className="text-meta">تاریخ ثبت</dt><dd className="text-label mt-1">{dateFormatter.format(company.createdAt)}</dd></div><div className="sm:col-span-2"><dt className="text-meta">آدرس</dt><dd className="text-label mt-1 whitespace-pre-wrap">{company.address}</dd></div>
        </dl></Card>
        <Card className="shadow-none"><h2 className="text-card-title">اطلاعات خصوصی حساب کارفرما</h2><p className="text-helper mt-2">این اطلاعات فقط در محیط مدیریت نمایش داده می‌شود.</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-meta">ایمیل</dt><dd dir="ltr" className="text-label mt-1 text-right break-all">{company.employerEmail ?? "—"}</dd></div><div><dt className="text-meta">شماره موبایل</dt><dd dir="ltr" className="text-label mt-1 text-right">{company.employerMobile ?? "—"}</dd></div></dl></Card>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="تفکیک وضعیت آگهی‌ها">
        <Card className="shadow-none"><p className="text-meta">پیش‌نویس</p><p className="mt-2 text-xl font-bold">{numberFormatter.format(jobs.draft)}</p></Card><Card className="shadow-none"><p className="text-meta">منتشرشده</p><p className="mt-2 text-xl font-bold">{numberFormatter.format(jobs.published)}</p></Card><Card className="shadow-none"><p className="text-meta">بسته‌شده</p><p className="mt-2 text-xl font-bold">{numberFormatter.format(jobs.closed)}</p></Card>
      </section>

      <Card className="mt-6 shadow-none"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-card-title">خلاصه خریدها</h2><p className="text-secondary">{numberFormatter.format(purchases.paidCount)} پرداخت‌شده / {numberFormatter.format(purchases.pendingCount)} در انتظار</p></div></Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="shadow-none"><h2 className="text-card-title">آخرین آگهی‌ها</h2>{recentJobs.length ? <ul className="mt-4 divide-y divide-ui-border">{recentJobs.map((job) => <li key={job.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><Link href={`/admin/jobs/${job.id}`} className="truncate font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{job.title}</Link><p className="text-helper mt-1">{dateFormatter.format(job.createdAt)}</p></div><Badge variant={job.status === "published" ? "success" : "neutral"}>{jobStatusLabels[job.status as JobStatus]}</Badge></li>)}</ul> : <p className="text-secondary mt-4">هنوز آگهی‌ای ثبت نشده است.</p>}</Card>
        <Card className="shadow-none"><h2 className="text-card-title">آخرین خریدها</h2>{recentPurchases.length ? <ul className="mt-4 divide-y divide-ui-border">{recentPurchases.map((purchase) => <li key={purchase.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{purchase.packageName}</p><Badge variant={purchase.status === "paid" ? "success" : "warning"}>{purchaseStatus[purchase.status]}</Badge></div><p className="text-helper mt-2">{numberFormatter.format(purchase.priceToman)} تومان · {numberFormatter.format(purchase.jobCredits)} اعتبار · {dateFormatter.format(purchase.purchasedAt)}</p></li>)}</ul> : <p className="text-secondary mt-4">هنوز خریدی ثبت نشده است.</p>}</Card>
      </div>

      <Card className="mt-6 shadow-none"><h2 className="text-card-title">آخرین تراکنش‌های اعتبار</h2>{recentCredits.length ? <ul className="mt-4 divide-y divide-ui-border">{recentCredits.map((transaction) => <li key={transaction.id} className="flex items-center justify-between gap-3 py-3"><span className={transaction.amount > 0 ? "font-bold text-success" : "font-bold text-danger"} dir="ltr">{transaction.amount > 0 ? "+" : ""}{numberFormatter.format(transaction.amount)}</span><span className="text-helper">{dateFormatter.format(transaction.createdAt)}</span></li>)}</ul> : <p className="text-secondary mt-4">هنوز تراکنش اعتباری ثبت نشده است.</p>}</Card>

      <Link href="/admin/employers" className={buttonClassNames({ variant: "secondary", className: "mt-6" })}>بازگشت به فهرست</Link>
    </div>
  );
}
