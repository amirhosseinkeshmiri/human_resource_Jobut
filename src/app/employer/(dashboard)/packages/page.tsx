import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "بسته‌های فعال",
};

export default function EmployerPackagesPage() {
  return (
    <div>
      <div>
        <p className="text-meta">بسته‌ها</p>
        <h1 className="text-page-title mt-2">بسته‌های فعال</h1>
        <p className="text-secondary mt-3">
          اطلاعات بسته‌ها و اعتبارهای فعال شرکت در این بخش قرار می‌گیرد.
        </p>
      </div>

      <Card className="mt-8 text-center shadow-none">
        <h2 className="text-card-title">بسته فعالی برای نمایش وجود ندارد</h2>
        <p className="text-secondary mx-auto mt-2 max-w-xl">
          خرید بسته و تخصیص اعتبار در مرحله مربوط به بسته‌ها پیاده‌سازی می‌شود.
        </p>
      </Card>
    </div>
  );
}
