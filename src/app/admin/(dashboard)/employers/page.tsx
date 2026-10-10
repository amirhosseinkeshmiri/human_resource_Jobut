import type { Metadata } from "next";
import Link from "next/link";
import { getAdminEmployers } from "@/admin/employers";
import { parseEmployerListParams, type EmployerSort } from "@/admin/employers-policy";
import { requireAdmin } from "@/admin-auth/session";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { Card, Input, Label, Select, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = { title: "مدیریت کارفرماها" };

interface PageProps {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[]; sort?: string | string[] }>;
}

const numberFormatter = new Intl.NumberFormat("fa-IR");
const moneyFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

const sortLabels: Record<EmployerSort, string> = {
  jobs_desc: "بیشترین تعداد آگهی",
  jobs_asc: "کمترین تعداد آگهی",
  paid_desc: "بیشترین خرید پرداخت‌شده",
  paid_asc: "کمترین خرید پرداخت‌شده",
  credits_desc: "بیشترین اعتبار",
  credits_asc: "کمترین اعتبار",
  newest: "جدیدترین شرکت",
};

function pageHref(page: number, query: string, sort: EmployerSort) {
  const params = new URLSearchParams({ page: String(page), sort });
  if (query) params.set("q", query);
  return `/admin/employers?${params.toString()}`;
}

export default async function AdminEmployersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = parseEmployerListParams(await searchParams);
  const result = await getAdminEmployers(params);

  return (
    <div>
      <div>
        <p className="text-meta">مدیریت خواندنی</p>
        <h1 className="text-page-title mt-2">کارفرماها</h1>
        <p className="text-secondary mt-3">نمای شرکت‌محور از فعالیت آگهی، خرید و اعتبار کارفرماها.</p>
      </div>

      <Card className="mt-8 shadow-none">
        <form method="get" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.45fr)_auto] md:items-end">
          <div>
            <Label htmlFor="employer-search">جست‌وجوی شرکت</Label>
            <Input id="employer-search" name="q" defaultValue={params.query} placeholder="نام شرکت یا آدرس" className="mt-2" />
          </div>
          <div>
            <Label htmlFor="employer-sort">مرتب‌سازی</Label>
            <Select id="employer-sort" name="sort" defaultValue={params.sort} className="mt-2">
              {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </div>
          <button type="submit" className={buttonClassNames({ className: "w-full md:w-auto" })}>اعمال</button>
        </form>
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-secondary">{numberFormatter.format(result.total)} شرکت</p>
        {params.query ? <Link href="/admin/employers" className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">پاک‌کردن جست‌وجو</Link> : null}
      </div>

      {result.items.length === 0 ? (
        <Card className="mt-4 text-center shadow-none"><p className="text-card-title">شرکتی پیدا نشد</p><p className="text-secondary mt-2">عبارت جست‌وجو یا شماره صفحه را بررسی کنید.</p></Card>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:hidden">
            {result.items.map((company) => (
              <Card key={company.id} className="shadow-none">
                <div className="flex items-start gap-3">
                  <CompanyLogo companyName={company.name} logoUrl={company.logoUrl} />
                  <div className="min-w-0 flex-1"><h2 className="font-bold">{company.name}</h2><p className="text-helper mt-1">{company.industryName}</p></div>
                </div>
                <p className="text-secondary mt-4 line-clamp-2">{company.address}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-meta">آگهی‌ها</dt><dd className="mt-1 font-semibold">{numberFormatter.format(company.totalJobs)} کل / {numberFormatter.format(company.publishedJobs)} منتشرشده</dd></div>
                  <div><dt className="text-meta">اعتبار</dt><dd className="mt-1 font-semibold">{numberFormatter.format(company.creditBalance)}</dd></div>
                  <div><dt className="text-meta">خرید پرداخت‌شده</dt><dd className="mt-1 font-semibold">{moneyFormatter.format(company.paidPurchaseTotal)} تومان</dd></div>
                  <div><dt className="text-meta">تاریخ ثبت</dt><dd className="mt-1 font-semibold">{dateFormatter.format(company.createdAt)}</dd></div>
                </dl>
                <Link href={`/admin/employers/${company.id}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "mt-5 w-full" })}>مشاهده جزئیات</Link>
              </Card>
            ))}
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-lg border border-ui-border bg-surface lg:block">
            <table className="w-full table-fixed text-right text-sm">
              <thead className="bg-surface-elevated text-text-secondary"><tr>
                <th className="w-[18%] px-3 py-3 font-semibold">شرکت</th><th className="w-[12%] px-3 py-3 font-semibold">صنعت</th><th className="w-[18%] px-3 py-3 font-semibold">آدرس</th><th className="w-[10%] px-3 py-3 font-semibold">آگهی‌ها</th><th className="w-[9%] px-3 py-3 font-semibold">اعتبار</th><th className="w-[14%] px-3 py-3 font-semibold">خرید پرداخت‌شده</th><th className="w-[11%] px-3 py-3 font-semibold">تاریخ ثبت</th><th className="w-[8%] px-3 py-3"><span className="sr-only">جزئیات</span></th>
              </tr></thead>
              <tbody className="divide-y divide-ui-border">
                {result.items.map((company) => <tr key={company.id} className="align-top">
                  <td className="px-3 py-4"><div className="flex items-center gap-2"><CompanyLogo companyName={company.name} logoUrl={company.logoUrl} /><span className="min-w-0 truncate font-semibold">{company.name}</span></div></td>
                  <td className="px-3 py-4 text-text-secondary">{company.industryName}</td>
                  <td className="px-3 py-4 text-text-secondary"><span className="line-clamp-2">{company.address}</span></td>
                  <td className="px-3 py-4"><span className="font-semibold">{numberFormatter.format(company.totalJobs)}</span><span className="text-helper mt-1 block">{numberFormatter.format(company.publishedJobs)} منتشرشده</span></td>
                  <td className="px-3 py-4 font-semibold">{numberFormatter.format(company.creditBalance)}</td>
                  <td className="px-3 py-4 font-semibold">{moneyFormatter.format(company.paidPurchaseTotal)} تومان</td>
                  <td className="px-3 py-4 text-text-secondary">{dateFormatter.format(company.createdAt)}</td>
                  <td className="px-3 py-4"><Link href={`/admin/employers/${company.id}`} className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">جزئیات</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}

      <nav aria-label="صفحه‌بندی کارفرماها" className="mt-6 flex items-center justify-between gap-3">
        {result.page > 1 ? <Link href={pageHref(result.page - 1, params.query, params.sort)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}
        <span className="text-sm text-text-secondary">صفحه {numberFormatter.format(result.page)} از {numberFormatter.format(result.pageCount)}</span>
        {result.page < result.pageCount ? <Link href={pageHref(result.page + 1, params.query, params.sort)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : <span />}
      </nav>
    </div>
  );
}
