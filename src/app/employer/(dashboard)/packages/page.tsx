import type { Metadata } from "next";
import { initiatePackagePurchase } from "@/packages/actions";
import { getEmployerPackagesPageData } from "@/packages/queries";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { Badge, Button, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "بسته‌های فعال",
};

interface EmployerPackagesPageProps {
  searchParams: Promise<{ purchase?: string | string[] }>;
}

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export default async function EmployerPackagesPage({ searchParams }: EmployerPackagesPageProps) {
  const [{ company }, params] = await Promise.all([
    getEmployerDashboardContext(),
    searchParams,
  ]);
  const data = await getEmployerPackagesPageData(company.id);
  const purchaseState = typeof params.purchase === "string" ? params.purchase : undefined;

  const purchaseMessage =
    purchaseState === "pending"
      ? "درخواست خرید به‌صورت در انتظار پرداخت ثبت شد. پرداخت آنلاین هنوز فعال نیست."
      : purchaseState === "unavailable"
        ? "بسته انتخاب‌شده در دسترس نیست."
        : purchaseState === "error"
          ? "ثبت درخواست خرید انجام نشد. دوباره تلاش کنید."
          : null;

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-meta">بسته‌ها</p>
          <h1 className="text-page-title mt-2">بسته‌های آگهی</h1>
          <p className="text-secondary mt-3">بسته‌های فعال و سابقه درخواست‌های خرید شرکت.</p>
        </div>
        <Card className="min-w-52 shadow-none">
          <p className="text-label">اعتبار فعلی آگهی</p>
          <p className="mt-2 text-3xl font-bold">
            {numberFormatter.format(data.remainingJobCredits)}
          </p>
        </Card>
      </div>

      {purchaseMessage ? (
        <p
          role="status"
          className="mt-6 rounded-md border border-ui-border bg-surface-elevated p-3 text-sm text-text-secondary"
        >
          {purchaseMessage}
        </p>
      ) : null}

      <section aria-labelledby="available-packages-title" className="mt-8">
        <h2 id="available-packages-title" className="text-section-title">بسته‌های قابل خرید</h2>
        {data.availablePackages.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.availablePackages.map((jobPackage) => (
              <Card key={jobPackage.id} className="flex h-full flex-col shadow-none">
                <h3 className="text-card-title">{jobPackage.name}</h3>
                <p className="mt-5 text-2xl font-bold">
                  {numberFormatter.format(jobPackage.jobCredits)} اعتبار آگهی
                </p>
                <p className="text-secondary mt-2">
                  {numberFormatter.format(jobPackage.priceToman)} تومان
                </p>
                <form action={initiatePackagePurchase} className="mt-6">
                  <input type="hidden" name="packageId" value={jobPackage.id} />
                  <Button type="submit" className="w-full">ثبت درخواست خرید</Button>
                </form>
                <p className="text-helper mt-3">پرداخت آنلاین هنوز پیکربندی نشده است.</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4 text-center shadow-none">
            <h3 className="text-card-title">بسته فعالی برای نمایش وجود ندارد</h3>
            <p className="text-secondary mx-auto mt-2 max-w-xl">
              پس از تعریف بسته‌های تأییدشده، آن‌ها در این بخش نمایش داده می‌شوند.
            </p>
          </Card>
        )}
      </section>

      <section aria-labelledby="purchase-history-title" className="mt-10">
        <h2 id="purchase-history-title" className="text-section-title">سابقه درخواست‌ها</h2>
        {data.purchases.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {data.purchases.map((purchase) => (
              <Card key={purchase.id} className="grid gap-3 shadow-none sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-card-title">{purchase.packageName}</h3>
                    <Badge variant={purchase.status === "paid" ? "success" : "warning"}>
                      {purchase.status === "paid" ? "پرداخت‌شده" : "در انتظار پرداخت"}
                    </Badge>
                  </div>
                  <p className="text-helper mt-2">
                    {numberFormatter.format(purchase.jobCredits)} اعتبار · {numberFormatter.format(purchase.priceToman)} تومان
                  </p>
                </div>
                <time className="text-meta" dateTime={purchase.purchasedAt.toISOString()}>
                  {dateFormatter.format(purchase.purchasedAt)}
                </time>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-secondary mt-4">هنوز درخواست خریدی ثبت نشده است.</p>
        )}
      </section>
    </div>
  );
}
