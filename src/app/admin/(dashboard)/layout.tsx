import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAdmin } from "@/admin-auth/actions";
import {
  isAdminManagementEnabled,
  shouldShowAdminManagementNavigation,
} from "@/admin-auth/admin-management-feature";
import { adminPageAccessPolicy, hasAdminPermission } from "@/admin-auth/authorization-policy";
import { requireActiveAdmin } from "@/admin-auth/rbac-guards";
import { Button, Container } from "@/components/ui";

interface AdminLayoutProps { children: ReactNode; }

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const principal = await requireActiveAdmin();
  const managementEnabled = isAdminManagementEnabled();
  const showAdminManagement = shouldShowAdminManagementNavigation({
    featureEnabled: managementEnabled,
    status: principal.status,
    isOwner: principal.isOwner,
  });
  const showPackageManagement = principal.isOwner;
  const navigation = [
    { href: "/admin", label: "خانه", permission: adminPageAccessPolicy.dashboard },
    { href: "/admin/jobs", label: "آگهی‌ها", permission: adminPageAccessPolicy.jobs },
    { href: "/admin/employers", label: "کارفرماها", permission: adminPageAccessPolicy.employers },
    { href: "/admin/sales", label: "فروش و اعتبار", permission: adminPageAccessPolicy.sales },
  ].filter(({ permission }) => hasAdminPermission(principal, permission));

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden bg-action text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs text-white/60">JOBUT</p>
          <p className="mt-1 font-bold">مدیریت شبکه استخدامی متخصصین آکادمیک</p>
        </div>
        <nav aria-label="ناوبری مدیریت" className="grid gap-1 p-3">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="rounded-md px-3 py-2.5 text-sm font-semibold text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">{item.label}</Link>)}
          {showPackageManagement && <Link href="/admin/packages" className="rounded-md px-3 py-2.5 text-sm font-semibold text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">بسته‌های آگهی</Link>}
          {showAdminManagement && <Link href="/admin/admins" className="rounded-md px-3 py-2.5 text-sm font-semibold text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">مدیریت مدیران</Link>}
        </nav>
        <form action={logoutAdmin} className="mt-auto border-t border-white/10 p-4">
          <Button type="submit" variant="ghost" className="w-full justify-start text-white hover:bg-white/10 hover:text-white">خروج</Button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-ui-border bg-surface lg:hidden">
          <Container width="dashboard" className="flex min-h-16 items-center justify-between gap-3">
            <div><p className="text-meta">JOBUT</p><p className="text-sm font-bold">مدیریت شبکه استخدامی متخصصین آکادمیک</p></div>
            <form action={logoutAdmin}><Button type="submit" variant="ghost" size="small">خروج</Button></form>
          </Container>
          <Container width="dashboard" as="nav" aria-label="ناوبری مدیریت موبایل" className="flex gap-2 overflow-x-auto border-t py-2">
            {navigation.map((item) => <Link key={item.href} href={item.href} className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-text-secondary outline-none hover:bg-action/10 hover:text-action focus-visible:ring-2 focus-visible:ring-focus">{item.label}</Link>)}
            {showPackageManagement && <Link href="/admin/packages" className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-text-secondary outline-none hover:bg-action/10 hover:text-action focus-visible:ring-2 focus-visible:ring-focus">بسته‌های آگهی</Link>}
            {showAdminManagement && <Link href="/admin/admins" className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-text-secondary outline-none hover:bg-action/10 hover:text-action focus-visible:ring-2 focus-visible:ring-focus">مدیریت مدیران</Link>}
          </Container>
        </header>
        <main><Container width="dashboard" className="py-8 sm:py-10">{children}</Container></main>
      </div>
    </div>
  );
}
