import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSales } from "@/admin/sales";
import {
  formatToman,
  parseAdminSalesParams,
  type CreditSort,
  type PurchaseStatusFilter,
  type SalesRange,
} from "@/admin/sales-policy";
import { requireAdmin } from "@/admin-auth/session";
import { SalesChart } from "@/components/admin/sales-chart";
import { Badge, Card, Select, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = { title: "فروش و اعتبار" };

interface PageProps {
  searchParams: Promise<{
    range?: string | string[];
    status?: string | string[];
    page?: string | string[];
    creditSort?: string | string[];
  }>;
}

const rangeLabels: Record<SalesRange, string> = { "7d": "۷ روز", "30d": "۳۰ روز", "90d": "۹۰ روز", "365d": "۳۶۵ روز" };
const statusLabels = { paid: "پرداخت‌شده", pending: "در انتظار پرداخت" } as const;
const filterLabels: Record<PurchaseStatusFilter, string> = { all: "همه", paid: "پرداخت‌شده", pending: "در انتظار پرداخت" };
const creditSortLabels: Record<CreditSort, string> = { credits_desc: "بیشترین اعتبار", credits_asc: "کمترین اعتبار", paid_desc: "بیشترین خرید پرداخت‌شده" };
const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function salesHref(params: { range: SalesRange; status: PurchaseStatusFilter; page?: number; creditSort: CreditSort }) {
  const query = new URLSearchParams({ range: params.range, status: params.status, creditSort: params.creditSort });
  if (params.page && params.page > 1) query.set("page", String(params.page));
  return `/admin/sales?${query.toString()}`;
}

export default async function AdminSalesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = parseAdminSalesParams(await searchParams);
  const data = await getAdminSales(params);
  const rangePaidTotal = data.buckets.reduce((total, bucket) => total + bucket.amount, 0);

  return (
    <div>
      <div><p className="text-meta">گزارش مالی خواندنی</p><h1 className="text-page-title mt-2">فروش و اعتبار</h1><p className="text-secondary mt-3">گزارش خریدهای ثبت‌شده و مانده واقعی دفترکل اعتبار کارفرماها.</p></div>

      <section aria-label="خلاصه فروش و اعتبار" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none"><p className="text-meta">مبلغ خریدهای پرداخت‌شده</p><p className="mt-3 text-2xl font-bold">{formatToman(data.summary.paidAmount)}</p></Card>
        <Card className="shadow-none"><p className="text-meta">خرید پرداخت‌شده</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(data.summary.paidCount)}</p></Card>
        <Card className="shadow-none"><p className="text-meta">خرید در انتظار پرداخت</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(data.summary.pendingCount)}</p></Card>
        <Card className="shadow-none"><p className="text-meta">اعتبار فعلی کارفرماها</p><p className="mt-3 text-2xl font-bold">{numberFormatter.format(data.summary.currentCredits)}</p></Card>
      </section>

      <Card className="mt-6 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-card-title">خریدهای پرداخت‌شده در گذر زمان</h2><p className="text-secondary mt-2">مجموع بازه انتخاب‌شده: {formatToman(rangePaidTotal)}</p></div><nav aria-label="بازه گزارش فروش" className="flex flex-wrap gap-2">{(Object.keys(rangeLabels) as SalesRange[]).map((range) => <Link key={range} href={salesHref({ ...params, range, page: 1 })} aria-current={range === params.range ? "page" : undefined} className={buttonClassNames({ variant: range === params.range ? "primary" : "secondary", size: "small" })}>{rangeLabels[range]}</Link>)}</nav></div>
        <div className="mt-6"><SalesChart buckets={data.buckets} /></div>
      </Card>

      <section className="mt-6" aria-labelledby="purchases-heading">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="purchases-heading" className="text-section-title">خریدها</h2><p className="text-secondary mt-2">{numberFormatter.format(data.purchaseTotal)} رکورد مطابق فیلتر</p></div><form method="get" className="flex items-end gap-2"><input type="hidden" name="range" value={params.range} /><input type="hidden" name="creditSort" value={params.creditSort} /><div><label htmlFor="purchase-status" className="text-label block">وضعیت خرید</label><Select id="purchase-status" name="status" defaultValue={params.status} className="mt-2">{Object.entries(filterLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><button type="submit" className={buttonClassNames({ size: "small" })}>اعمال</button></form></div>

        {data.purchases.length ? <>
          <div className="mt-4 grid gap-3 lg:hidden">{data.purchases.map((purchase) => <Card key={purchase.id} className="shadow-none"><div className="flex items-start justify-between gap-3"><Link href={`/admin/employers/${purchase.companyId}`} className="font-bold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{purchase.companyName}</Link><Badge variant={purchase.status === "paid" ? "success" : "warning"}>{statusLabels[purchase.status]}</Badge></div><p className="mt-3 font-semibold">{purchase.packageName}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-meta">اعتبار بسته</dt><dd className="mt-1 font-semibold">{numberFormatter.format(purchase.jobCredits)}</dd></div><div><dt className="text-meta">مبلغ</dt><dd className="mt-1 font-semibold">{formatToman(purchase.priceToman)}</dd></div><div><dt className="text-meta">تاریخ خرید</dt><dd className="mt-1">{dateFormatter.format(purchase.purchasedAt)}</dd></div><div><dt className="text-meta">تاریخ پرداخت</dt><dd className="mt-1">{purchase.paidAt ? dateFormatter.format(purchase.paidAt) : "—"}</dd></div></dl></Card>)}</div>
          <div className="mt-4 hidden overflow-hidden rounded-lg border border-ui-border bg-surface lg:block"><table className="w-full table-fixed text-right text-sm"><thead className="bg-surface-elevated text-text-secondary"><tr><th className="w-[20%] px-4 py-3">شرکت</th><th className="w-[17%] px-4 py-3">بسته</th><th className="w-[9%] px-4 py-3">اعتبار</th><th className="w-[15%] px-4 py-3">مبلغ</th><th className="w-[13%] px-4 py-3">وضعیت</th><th className="w-[13%] px-4 py-3">تاریخ خرید</th><th className="w-[13%] px-4 py-3">تاریخ پرداخت</th></tr></thead><tbody className="divide-y divide-ui-border">{data.purchases.map((purchase) => <tr key={purchase.id}><td className="px-4 py-4"><Link href={`/admin/employers/${purchase.companyId}`} className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{purchase.companyName}</Link></td><td className="px-4 py-4 font-semibold">{purchase.packageName}</td><td className="px-4 py-4">{numberFormatter.format(purchase.jobCredits)}</td><td className="px-4 py-4">{formatToman(purchase.priceToman)}</td><td className="px-4 py-4"><Badge variant={purchase.status === "paid" ? "success" : "warning"}>{statusLabels[purchase.status]}</Badge></td><td className="px-4 py-4 text-text-secondary">{dateFormatter.format(purchase.purchasedAt)}</td><td className="px-4 py-4 text-text-secondary">{purchase.paidAt ? dateFormatter.format(purchase.paidAt) : "—"}</td></tr>)}</tbody></table></div>
        </> : <Card className="mt-4 text-center shadow-none"><p className="text-card-title">خریدی در این وضعیت ثبت نشده است</p></Card>}
        <nav aria-label="صفحه‌بندی خریدها" className="mt-5 flex items-center justify-between gap-3">{data.page > 1 ? <Link href={salesHref({ ...params, page: data.page - 1 })} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}<span className="text-sm text-text-secondary">صفحه {numberFormatter.format(data.page)} از {numberFormatter.format(data.pageCount)}</span>{data.page < data.pageCount ? <Link href={salesHref({ ...params, page: data.page + 1 })} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : <span />}</nav>
      </section>

      <section className="mt-8" aria-labelledby="credits-heading"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="credits-heading" className="text-section-title">اعتبار شرکت‌ها</h2><p className="text-secondary mt-2">مانده دفترکل و مجموع خریدهای پرداخت‌شده</p></div><form method="get" className="flex items-end gap-2"><input type="hidden" name="range" value={params.range} /><input type="hidden" name="status" value={params.status} /><div><label htmlFor="credit-sort" className="text-label block">مرتب‌سازی</label><Select id="credit-sort" name="creditSort" defaultValue={params.creditSort} className="mt-2">{Object.entries(creditSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><button type="submit" className={buttonClassNames({ size: "small" })}>اعمال</button></form></div>
        {data.companyCredits.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.companyCredits.map((company) => <Card key={company.companyId} className="shadow-none"><Link href={`/admin/employers/${company.companyId}`} className="font-bold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{company.companyName}</Link><dl className="mt-4 grid grid-cols-2 gap-3"><div><dt className="text-meta">مانده اعتبار</dt><dd dir="ltr" className={`mt-1 text-right text-lg font-bold ${company.balance < 0 ? "text-danger" : ""}`}>{numberFormatter.format(company.balance)}</dd></div><div><dt className="text-meta">خرید پرداخت‌شده</dt><dd className="mt-1 font-semibold">{formatToman(company.paidAmount)}</dd></div></dl></Card>)}</div> : <Card className="mt-4 text-center shadow-none"><p className="text-card-title">هنوز شرکتی ثبت نشده است</p></Card>}
      </section>
    </div>
  );
}
