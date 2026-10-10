import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAdmin } from "@/admin-auth/actions";
import { requireAdmin } from "@/admin-auth/session";
import { Button, Container } from "@/components/ui";

interface AdminLayoutProps { children: ReactNode; }

const unavailableItems = ["فروش و اعتبار"];

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden bg-[#13231d] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs text-white/60">JobUT</p>
          <p className="mt-1 font-bold">مدیریت جاب یوتی</p>
        </div>
        <nav aria-label="ناوبری مدیریت" className="grid gap-1 p-3">
          <Link href="/admin" className="rounded-md px-3 py-2.5 text-sm font-semibold text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">خانه</Link>
          <Link href="/admin/employers" className="rounded-md px-3 py-2.5 text-sm font-semibold text-white/75 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">کارفرماها</Link>
          {unavailableItems.map((item) => <span key={item} aria-disabled="true" className="cursor-not-allowed rounded-md px-3 py-2.5 text-sm text-white/45">{item} — به‌زودی</span>)}
        </nav>
        <form action={logoutAdmin} className="mt-auto border-t border-white/10 p-4">
          <Button type="submit" variant="ghost" className="w-full justify-start text-white hover:bg-white/10 hover:text-white">خروج</Button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-ui-border bg-surface lg:hidden">
          <Container width="dashboard" className="flex min-h-16 items-center justify-between gap-3">
            <div><p className="text-meta">JobUT</p><p className="text-sm font-bold">مدیریت جاب یوتی</p></div>
            <form action={logoutAdmin}><Button type="submit" variant="ghost" size="small">خروج</Button></form>
          </Container>
          <Container width="dashboard" as="nav" aria-label="ناوبری مدیریت موبایل" className="flex gap-2 overflow-x-auto border-t py-2">
            <Link href="/admin" className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-text-secondary outline-none hover:bg-action/10 hover:text-action focus-visible:ring-2 focus-visible:ring-focus">خانه</Link>
            <Link href="/admin/employers" className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-text-secondary outline-none hover:bg-action/10 hover:text-action focus-visible:ring-2 focus-visible:ring-focus">کارفرماها</Link>
            {unavailableItems.map((item) => <span key={item} aria-disabled="true" className="shrink-0 rounded-md px-3 py-2 text-xs text-text-muted">{item} — به‌زودی</span>)}
          </Container>
        </header>
        <main><Container width="dashboard" className="py-8 sm:py-10">{children}</Container></main>
      </div>
    </div>
  );
}
