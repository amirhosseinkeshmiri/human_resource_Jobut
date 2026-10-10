import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDashboardMetrics } from "@/admin/metrics";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "داشبورد مدیریت" };

const numberFormatter = new Intl.NumberFormat("fa-IR");

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardMetrics();
  const cards = [
    { label: "کل آگهی‌ها", value: numberFormatter.format(metrics.totalJobPosts), description: "تمام وضعیت‌های آگهی", href: "/admin/jobs" },
    { label: "آگهی‌های منتشرشده", value: numberFormatter.format(metrics.publishedJobPosts), description: "وضعیت منتشرشده در پایگاه داده", href: "/admin/jobs?status=published_active" },
    { label: "کارفرماها", value: numberFormatter.format(metrics.companies), description: "شرکت‌های ثبت‌شده", href: "/admin/employers" },
    { label: "حساب‌های کارجو", value: numberFormatter.format(metrics.candidateAccounts), description: "هویت‌های احراز‌شده کارجو" },
    { label: "مبلغ خریدهای پرداخت‌شده", value: `${numberFormatter.format(metrics.paidPurchaseAmountToman)} تومان`, description: "جمع مبلغ بسته‌های دارای وضعیت پرداخت‌شده", href: "/admin/sales" },
    { label: "اعتبار فعلی کارفرماها", value: numberFormatter.format(metrics.totalEmployerCredits), description: "جمع مانده دفترکل اعتبار همه شرکت‌ها", href: "/admin/sales" },
  ];

  return (
    <div>
      <div>
        <p className="text-meta">نمای عملیاتی</p>
        <h1 className="text-page-title mt-2">داشبورد مدیریت</h1>
        <p className="text-secondary mt-3">خلاصه وضعیت فعلی داده‌های قابل اتکای جاب یوتی.</p>
      </div>
      <section aria-label="شاخص‌های مدیریتی" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => card.href ? (
          <Link key={card.label} href={card.href} className="rounded-lg outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-focus">
            <DashboardStatCard {...card} />
          </Link>
        ) : <DashboardStatCard key={card.label} {...card} />)}
      </section>
      <Card className="mt-8 shadow-none">
        <h2 className="text-card-title">دامنه گزارش فعلی</h2>
        <p className="text-secondary mt-2">شاخص‌های رزومه، فعالیت روزانه و وضعیت فعال یا غیرفعال کارجو پس از تعریف مدل‌های معتبر مربوط به آن‌ها قابل ارائه خواهند بود.</p>
      </Card>
    </div>
  );
}
