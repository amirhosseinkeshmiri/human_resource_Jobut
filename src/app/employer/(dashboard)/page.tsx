import type { Metadata } from "next";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";

export const metadata: Metadata = {
  title: "خانه کارفرما",
};

const statistics = [
  {
    label: "آگهی‌های فعال",
    description: "آمار آگهی‌ها در مرحله مدیریت آگهی‌ها فعال می‌شود.",
  },
  {
    label: "رزومه‌های جدید",
    description: "این بخش تا زمان پیاده‌سازی دامنه کارجو و درخواست‌ها خالی می‌ماند.",
  },
  {
    label: "آگهی‌های باقیمانده",
    description: "اعتبار قابل استفاده در مرحله بسته‌ها و اعتبارها نمایش داده می‌شود.",
  },
];

export default function EmployerHomePage() {
  return (
    <div>
      <div>
        <p className="text-meta">خانه</p>
        <h1 className="text-page-title mt-2">نمای کلی</h1>
        <p className="text-secondary mt-3">ساختار اولیه فضای کارفرما برای بخش‌های آینده.</p>
      </div>

      <section aria-label="شاخص‌های کلیدی" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statistics.map((statistic) => (
          <DashboardStatCard
            key={statistic.label}
            label={statistic.label}
            value="—"
            description={statistic.description}
          />
        ))}
      </section>
    </div>
  );
}
