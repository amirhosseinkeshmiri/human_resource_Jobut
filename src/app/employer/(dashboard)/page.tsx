import type { Metadata } from "next";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { FormDraftCleanup } from "@/components/forms/form-draft-cleanup";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { getEmployerDashboardMetrics } from "@/dashboard/metrics";

export const metadata: Metadata = {
  title: "خانه کارفرما",
};

interface EmployerHomePageProps {
  searchParams: Promise<{ companySaved?: string | string[] }>;
}

export default async function EmployerHomePage({ searchParams }: EmployerHomePageProps) {
  const [{ companySaved }, { company, employer }] = await Promise.all([searchParams, getEmployerDashboardContext()]);
  const metrics = await getEmployerDashboardMetrics(company.id);

  return (
    <div>
      {companySaved === "1" ? <FormDraftCleanup scopes={[
        { accountId: employer.id, formId: "company-profile", entityId: "new" },
        { accountId: employer.id, formId: "company-profile", entityId: company.id },
      ]} /> : null}
      <div>
        <p className="text-meta">خانه</p>
        <h1 className="text-page-title mt-2">نمای کلی</h1>
        <p className="text-secondary mt-3">ساختار اولیه فضای کارفرما برای بخش‌های آینده.</p>
      </div>

      <section aria-label="شاخص‌های کلیدی" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard
          label="آگهی‌های فعال"
          value={metrics.activeJobPosts.toLocaleString("fa-IR")}
          description="تعداد آگهی‌های منتشرشده شرکت"
        />
        <DashboardStatCard
          label="رزومه‌های دریافتی"
          value={metrics.receivedApplications.toLocaleString("fa-IR")}
          description="کل درخواست‌های ارسال‌شده برای آگهی‌های شرکت"
        />
        <DashboardStatCard
          label="آگهی‌های باقیمانده"
          value={metrics.remainingJobCredits.toLocaleString("fa-IR")}
          description="موجودی واقعی اعتبار ثبت آگهی شرکت"
        />
      </section>
    </div>
  );
}
