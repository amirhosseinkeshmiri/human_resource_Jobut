import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SepPaymentButton } from "@/components/payments/sep-payment-button";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { getCompanyPackagePurchase } from "@/packages/queries";

export const metadata: Metadata = { title: "پرداخت بسته آگهی" };
export const dynamic = "force-dynamic";

interface PaymentPageProps {
  params: Promise<{ purchaseId: string }>;
  searchParams: Promise<{ result?: string | string[] }>;
}

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });

export default async function PaymentPage({ params, searchParams }: PaymentPageProps) {
  const [{ company }, route, query] = await Promise.all([
    getEmployerDashboardContext(),
    params,
    searchParams,
  ]);
  const purchase = await getCompanyPackagePurchase(company.id, route.purchaseId);
  if (!purchase) notFound();

  const result = typeof query.result === "string" ? query.result : undefined;
  const resultMessage =
    purchase.status === "paid"
      ? "پرداخت تأیید شد و اعتبار بسته به حساب شرکت افزوده شد."
      : result === "canceled"
        ? "پرداخت لغو شد. در صورت تمایل دوباره تلاش کنید."
        : result === "failed" || result === "invalid"
          ? "پرداخت تأیید نشد. می‌توانید دوباره تلاش کنید."
          : null;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-meta">بسته‌های آگهی</p>
      <h1 className="text-page-title mt-2">پرداخت درخواست خرید</h1>
      {resultMessage ? (
        <p role="status" className="mt-5 rounded-md border border-ui-border bg-surface-elevated p-3 text-sm">
          {resultMessage}
        </p>
      ) : null}

      <Card className="mt-6 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-card-title">{purchase.packageName}</h2>
            <p className="text-secondary mt-2">
              {numberFormatter.format(purchase.jobCredits)} اعتبار آگهی
            </p>
          </div>
          <Badge variant={purchase.status === "paid" ? "success" : "warning"}>
            {purchase.status === "paid" ? "پرداخت‌شده" : "در انتظار پرداخت"}
          </Badge>
        </div>
        <dl className="mt-6 grid gap-4 border-y border-ui-border py-5 sm:grid-cols-2">
          <div><dt className="text-label">مبلغ</dt><dd className="mt-1 font-bold">{numberFormatter.format(purchase.priceToman)} تومان</dd></div>
          <div><dt className="text-label">زمان ثبت</dt><dd className="mt-1">{dateFormatter.format(purchase.purchasedAt)}</dd></div>
          {purchase.paidAt ? <div><dt className="text-label">زمان پرداخت</dt><dd className="mt-1">{dateFormatter.format(purchase.paidAt)}</dd></div> : null}
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {purchase.status === "pending" ? <SepPaymentButton purchaseId={purchase.id} /> : null}
          <Link href="/employer/packages" className={buttonClassNames({ variant: "secondary" })}>
            بازگشت به بسته‌ها
          </Link>
        </div>
      </Card>
    </div>
  );
}
