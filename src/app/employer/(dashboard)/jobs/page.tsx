import type { Metadata } from "next";
import { Button, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "مدیریت آگهی‌ها",
};

export default function EmployerJobsPage() {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-meta">آگهی‌ها</p>
          <h1 className="text-page-title mt-2">مدیریت آگهی‌ها</h1>
          <p className="text-secondary mt-3">فهرست و عملیات آگهی‌های شرکت در این بخش قرار می‌گیرد.</p>
        </div>
        <Button type="button" disabled className="w-full sm:w-auto">
          افزودن آگهی جدید
        </Button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="shadow-none">
          <p className="text-label">اعتبار آگهی باقی‌مانده</p>
          <p className="mt-4 text-3xl font-bold">—</p>
          <p className="text-helper mt-2">پس از پیاده‌سازی منطق اعتبار نمایش داده می‌شود.</p>
        </Card>
        <Card className="text-center shadow-none">
          <h2 className="text-card-title">هنوز آگهی‌ای برای نمایش وجود ندارد</h2>
          <p className="text-secondary mx-auto mt-2 max-w-xl">
            ایجاد و مدیریت آگهی در مرحله اختصاصی مدیریت آگهی‌ها فعال می‌شود.
          </p>
        </Card>
      </div>
    </div>
  );
}
