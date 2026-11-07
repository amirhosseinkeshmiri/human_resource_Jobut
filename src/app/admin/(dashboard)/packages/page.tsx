import type { Metadata } from "next";
import { requireOwnerOnlyOperation } from "@/admin-auth/rbac-guards";
import { listAdminPackages } from "@/admin/packages";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { Badge, Card, Input, Label } from "@/components/ui";
import { createPackageAction, deletePackageAction, updatePackageAction } from "./actions";

export const metadata: Metadata = { title: "مدیریت بسته‌های آگهی" };
export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });

const resultMessages: Record<string, { tone: string; text: string }> = {
  created: { tone: "border-success/30 bg-success/10 text-success", text: "بسته با موفقیت ایجاد شد." },
  updated: { tone: "border-success/30 bg-success/10 text-success", text: "تغییرات بسته با موفقیت ذخیره شد." },
  invalid: { tone: "border-danger/30 bg-danger/10 text-danger", text: "مقادیر واردشده معتبر نیست. قیمت و اعتبار باید عدد صحیح مثبت باشند." },
  stale: { tone: "border-warning/30 bg-warning/10 text-text-primary", text: "این بسته هم‌زمان تغییر کرده است. صفحه تازه شد؛ تغییرات را دوباره بررسی کنید." },
  error: { tone: "border-danger/30 bg-danger/10 text-danger", text: "ذخیره بسته انجام نشد. دوباره تلاش کنید." },
  deleted: { tone: "border-success/30 bg-success/10 text-success", text: "بسته بدون سابقه خرید به‌صورت دائمی حذف شد." },
  "delete-blocked": { tone: "border-warning/30 bg-warning/10 text-text-primary", text: "این بسته سابقه خرید دارد و قابل حذف دائمی نیست. برای جلوگیری از نمایش و خرید جدید، آن را غیرفعال کنید." },
  "delete-confirmation": { tone: "border-danger/30 bg-danger/10 text-danger", text: "نام تأییدی با نام فعلی بسته مطابقت ندارد؛ حذف انجام نشد." },
  "delete-stale": { tone: "border-warning/30 bg-warning/10 text-text-primary", text: "بسته پس از باز شدن فرم تغییر کرده است؛ حذف انجام نشد. اطلاعات تازه را بررسی کنید." },
  "delete-missing": { tone: "border-warning/30 bg-warning/10 text-text-primary", text: "بسته قبلاً حذف شده یا دیگر وجود ندارد." },
  "delete-invalid": { tone: "border-danger/30 bg-danger/10 text-danger", text: "درخواست حذف معتبر نیست." },
  "delete-error": { tone: "border-danger/30 bg-danger/10 text-danger", text: "حذف دائمی انجام نشد و هیچ تغییری ثبت نشد." },
};

interface PageProps { searchParams: Promise<{ result?: string | string[] }>; }

export default async function AdminPackagesPage({ searchParams }: PageProps) {
  await requireOwnerOnlyOperation("admin.packages.manage");
  const packages = await listAdminPackages();
  const rawResult = (await searchParams).result;
  const message = typeof rawResult === "string" ? resultMessages[rawResult] : undefined;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-meta">کاتالوگ فروش</p>
        <h1 className="text-page-title mt-2">مدیریت بسته‌های آگهی</h1>
        <p className="text-secondary mt-3">تغییرات فقط روی خریدهای جدید اعمال می‌شود؛ snapshot خریدهای قبلی ثابت می‌ماند.</p>
      </div>
      {message ? <p role="status" className={`rounded-md border p-3 text-sm ${message.tone}`}>{message.text}</p> : null}

      <Card>
        <h2 className="text-card-title">ایجاد بسته</h2>
        <form action={createPackageAction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <div><Label htmlFor="new-package-name">نام بسته</Label><Input id="new-package-name" name="name" required maxLength={120} className="mt-2" /></div>
          <div><Label htmlFor="new-package-price">قیمت (تومان)</Label><Input id="new-package-price" name="priceToman" type="number" inputMode="numeric" min={1} max={2147483647} step={1} required className="mt-2" /></div>
          <div><Label htmlFor="new-package-credits">تعداد اعتبار آگهی</Label><Input id="new-package-credits" name="jobCredits" type="number" inputMode="numeric" min={1} max={2147483647} step={1} required className="mt-2" /></div>
          <div><Label htmlFor="new-package-order">ترتیب نمایش (اختیاری)</Label><Input id="new-package-order" name="displayOrder" type="number" inputMode="numeric" min={0} max={2147483647} step={1} className="mt-2" /></div>
          <div><Label htmlFor="new-package-validity">توضیح بازاریابی دوره (اختیاری)</Label><Input id="new-package-validity" name="displayValidityText" maxLength={120} className="mt-2" /><p className="text-helper mt-1">این متن حق یا مدت اعتبار اجرایی ایجاد نمی‌کند.</p></div>
          <div><Label htmlFor="new-package-payment">توضیح پرداخت (اختیاری)</Label><Input id="new-package-payment" name="paymentDescription" maxLength={240} className="mt-2" /></div>
          <div className="grid gap-2"><label className="flex min-h-9 items-center gap-2 text-sm font-semibold"><input name="isActive" type="checkbox" defaultChecked /> در جدول عمومی فعال باشد</label><label className="flex min-h-9 items-center gap-2 text-sm font-semibold"><input name="onlineCheckoutEnabled" type="checkbox" defaultChecked /> پرداخت آنلاین مجاز باشد</label></div>
          <PendingSubmitButton className="xl:col-start-4">ایجاد بسته</PendingSubmitButton>
        </form>
      </Card>

      <section className="grid gap-4" aria-label="همه بسته‌های آگهی">
        {packages.length === 0 ? <Card><p className="text-secondary">هنوز بسته‌ای ثبت نشده است.</p></Card> : null}
        {packages.map((jobPackage) => (
          <Card key={jobPackage.id} className="shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-card-title">{jobPackage.name}</h2><p className="text-helper mt-2">ایجاد: {dateFormatter.format(jobPackage.createdAt)} · ویرایش: {dateFormatter.format(jobPackage.updatedAt)}</p></div>
              <Badge variant={jobPackage.isActive ? "success" : "neutral"}>{jobPackage.isActive ? "فعال" : "غیرفعال"}</Badge>
            </div>
            <form action={updatePackageAction} className="mt-5 grid gap-4 border-t border-ui-border pt-5 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
              <input type="hidden" name="packageId" value={jobPackage.id} />
              <input type="hidden" name="updatedAt" value={jobPackage.updatedAt.toISOString()} />
              <div><Label htmlFor={`name-${jobPackage.id}`}>نام بسته</Label><Input id={`name-${jobPackage.id}`} name="name" defaultValue={jobPackage.name} required maxLength={120} className="mt-2" /></div>
              <div><Label htmlFor={`price-${jobPackage.id}`}>قیمت (تومان)</Label><Input id={`price-${jobPackage.id}`} name="priceToman" type="number" inputMode="numeric" min={1} max={2147483647} step={1} defaultValue={jobPackage.priceToman} required className="mt-2" /><p className="text-helper mt-1">{numberFormatter.format(jobPackage.priceToman)} تومان</p></div>
              <div><Label htmlFor={`credits-${jobPackage.id}`}>اعتبار آگهی</Label><Input id={`credits-${jobPackage.id}`} name="jobCredits" type="number" inputMode="numeric" min={1} max={2147483647} step={1} defaultValue={jobPackage.jobCredits} required className="mt-2" /></div>
              <div><Label htmlFor={`order-${jobPackage.id}`}>ترتیب نمایش</Label><Input id={`order-${jobPackage.id}`} name="displayOrder" type="number" inputMode="numeric" min={0} max={2147483647} step={1} defaultValue={jobPackage.displayOrder ?? ""} className="mt-2" /></div>
              <div><Label htmlFor={`validity-${jobPackage.id}`}>توضیح بازاریابی دوره</Label><Input id={`validity-${jobPackage.id}`} name="displayValidityText" defaultValue={jobPackage.displayValidityText ?? ""} maxLength={120} className="mt-2" /><p className="text-helper mt-1">صرفاً نمایشی؛ مدت نمایش آگهی مستقل است.</p></div>
              <div><Label htmlFor={`payment-${jobPackage.id}`}>توضیح پرداخت</Label><Input id={`payment-${jobPackage.id}`} name="paymentDescription" defaultValue={jobPackage.paymentDescription ?? ""} maxLength={240} className="mt-2" /></div>
              <div className="grid gap-2"><label className="flex min-h-9 items-center gap-2 text-sm font-semibold"><input name="isActive" type="checkbox" defaultChecked={jobPackage.isActive} /> در جدول عمومی فعال باشد</label><label className="flex min-h-9 items-center gap-2 text-sm font-semibold"><input name="onlineCheckoutEnabled" type="checkbox" defaultChecked={jobPackage.onlineCheckoutEnabled} /> پرداخت آنلاین مجاز باشد</label></div>
              <PendingSubmitButton variant="secondary" className="xl:col-start-4">ذخیره تغییرات</PendingSubmitButton>
            </form>
            <details className="mt-5 rounded-md border border-danger/30 bg-danger/5 p-4">
              <summary className="cursor-pointer font-semibold text-danger">حذف دائمی</summary>
              <p className="text-secondary mt-3">این عملیات برگشت‌پذیر نیست و فقط وقتی انجام می‌شود که هیچ خریدی به بسته وابسته نباشد. در غیر این صورت بسته را غیرفعال کنید.</p>
              <form action={deletePackageAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <input type="hidden" name="packageId" value={jobPackage.id} />
                <input type="hidden" name="updatedAt" value={jobPackage.updatedAt.toISOString()} />
                <div><Label htmlFor={`delete-name-${jobPackage.id}`}>برای تأیید، نام «{jobPackage.name}» را دقیق وارد کنید</Label><Input id={`delete-name-${jobPackage.id}`} name="confirmedName" required autoComplete="off" className="mt-2" /></div>
                <PendingSubmitButton variant="destructive">حذف دائمی و برگشت‌ناپذیر</PendingSubmitButton>
              </form>
            </details>
          </Card>
        ))}
      </section>
    </div>
  );
}
