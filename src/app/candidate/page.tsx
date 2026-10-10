import type { Metadata } from "next";
import Link from "next/link";
import { logoutCandidate } from "@/candidate-auth/actions";
import { requireCandidate } from "@/candidate-auth/session";
import { Button, Card, Container, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = { title: "پنل کارجو" };

export default async function CandidateDashboardPage() {
  await requireCandidate();

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-ui-border bg-surface">
        <Container className="flex min-h-16 items-center justify-between gap-4">
          <Link href="/candidate" className="text-lg font-bold outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">جاب یوتی</Link>
          <form action={logoutCandidate}>
            <Button type="submit" variant="ghost" size="small">خروج</Button>
          </form>
        </Container>
      </header>

      <Container className="py-8 sm:py-12">
        <nav aria-label="ناوبری پنل کارجو" className="mb-8 flex flex-wrap gap-2">
          <Link href="/candidate" aria-current="page" className={buttonClassNames({ variant: "secondary", size: "small" })}>خانه</Link>
          <Link href="/jobs" className={buttonClassNames({ variant: "secondary", size: "small" })}>فرصت‌های شغلی</Link>
          <span aria-disabled="true" className="inline-flex min-h-9 cursor-not-allowed items-center rounded-md border bg-surface-elevated px-3 text-sm font-semibold text-text-muted">رزومه — به‌زودی</span>
        </nav>

        <div className="max-w-3xl">
          <p className="text-meta">پنل کارجو</p>
          <h1 className="text-page-title mt-2">خوش آمدید</h1>
          <p className="text-secondary mt-3">از این بخش می‌توانید فرصت‌های شغلی فعال جاب یوتی را مشاهده کنید.</p>
          <Card className="mt-8 shadow-none">
            <h2 className="text-card-title">فرصت‌های شغلی</h2>
            <p className="text-secondary mt-2">مشاهده فرصت‌ها برای همه کاربران آزاد است و به ورود نیاز ندارد.</p>
            <Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده فرصت‌های شغلی</Link>
          </Card>
        </div>
      </Container>
    </div>
  );
}
