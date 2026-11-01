import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdminManagementEnabled } from "@/admin-auth/admin-management-feature";
import { adminPermissions } from "@/admin-auth/permissions";
import { requireSuperAdmin } from "@/admin-auth/rbac-guards";
import { listOrdinaryAdminAccounts } from "@/admin-auth/rbac-service";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import {
  createAdminAccountAction,
  updateAdminPermissionAction,
  updateAdminStatusAction,
} from "./actions";

export const metadata: Metadata = { title: "مدیریت مدیران" };

const permissionLabels = {
  "admin.dashboard.read": "مشاهده داشبورد",
  "admin.employers.read": "مشاهده کارفرماها",
  "admin.jobs.read": "مشاهده آگهی‌ها",
  "admin.sales.read": "مشاهده فروش و اعتبار",
} as const;

export default async function AdminAccountsPage() {
  if (!isAdminManagementEnabled()) notFound();
  const owner = await requireSuperAdmin();
  const accounts = await listOrdinaryAdminAccounts(owner.adminAccountId);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-meta">کنترل دسترسی</p>
        <h1 className="text-page-title mt-2">مدیریت مدیران</h1>
        <p className="text-secondary mt-3">حساب جدید بدون هیچ مجوزی ساخته می‌شود و ورود آن همچنان نیازمند OTP است.</p>
      </div>

      <Card>
        <h2 className="text-card-title">ایجاد مدیر عادی</h2>
        <form action={createAdminAccountAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <Label htmlFor="admin-identifier">ایمیل یا شماره همراه تأییدشده</Label>
            <Input id="admin-identifier" name="identifier" dir="ltr" required maxLength={320} className="mt-2" />
          </div>
          <Button type="submit">ایجاد حساب بدون مجوز</Button>
        </form>
      </Card>

      <section className="grid gap-4" aria-label="مدیران عادی">
        {accounts.length === 0 && <Card><p className="text-secondary">مدیر عادی ثبت نشده است.</p></Card>}
        {accounts.map((account) => {
          const assigned = new Set(account.permissions);
          return (
            <Card key={account.id} className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p dir="ltr" className="font-semibold">{account.email ?? account.mobile}</p>
                  <p dir="ltr" className="mt-1 text-xs text-text-muted">{account.id}</p>
                </div>
                <Badge>{account.status === "active" ? "فعال" : "غیرفعال"}</Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {adminPermissions.map((permission) => (
                  <form key={permission} action={updateAdminPermissionAction} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <input type="hidden" name="adminAccountId" value={account.id} />
                    <input type="hidden" name="permission" value={permission} />
                    <input type="hidden" name="operation" value={assigned.has(permission) ? "revoke" : "grant"} />
                    <span className="text-sm">{permissionLabels[permission]}</span>
                    <Button type="submit" size="small" variant={assigned.has(permission) ? "ghost" : "secondary"}>
                      {assigned.has(permission) ? "لغو" : "اعطا"}
                    </Button>
                  </form>
                ))}
              </div>

              <form action={updateAdminStatusAction} className="grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <input type="hidden" name="adminAccountId" value={account.id} />
                <input type="hidden" name="operation" value={account.status === "active" ? "disable" : "enable"} />
                {account.status === "active" ? (
                  <div><Label htmlFor={`reason-${account.id}`}>علت غیرفعال‌سازی</Label><Input id={`reason-${account.id}`} name="reason" required maxLength={500} className="mt-2" /></div>
                ) : <p className="text-secondary">فعال‌سازی مجدد، session جدید ایجاد نمی‌کند.</p>}
                <Button type="submit" variant="secondary">{account.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}</Button>
              </form>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
