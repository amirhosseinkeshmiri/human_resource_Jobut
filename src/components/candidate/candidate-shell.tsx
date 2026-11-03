import type { ReactNode } from "react";
import Link from "next/link";
import { logoutCandidate } from "@/candidate-auth/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button, Container, buttonClassNames } from "@/components/ui";
import { PUBLIC_JOBS_LABEL, PUBLIC_JOBS_ROUTE } from "@/jobs/public-copy";
import { getBrowserNavigationIdentity } from "@/auth/browser-account-context";
import { isCandidateSavedJobsEnabled } from "@/saved-jobs/policy";

type CandidateSection = "home" | "profile" | "resume" | "preferences" | "recommended-jobs" | "applications" | "saved-jobs" | "notifications" | "legal" | "privacy";

interface CandidateShellProps {
  children: ReactNode;
  current: CandidateSection;
}

const navigationItems: ReadonlyArray<{ href: string; label: string; section?: CandidateSection }> = [
  { href: "/candidate", label: "خانه", section: "home" },
  { href: "/candidate/profile", label: "پروفایل", section: "profile" },
  { href: PUBLIC_JOBS_ROUTE, label: PUBLIC_JOBS_LABEL },
  { href: "/candidate/recommended-jobs", label: "آگهی‌های پیشنهادی", section: "recommended-jobs" },
  { href: "/candidate/resume", label: "رزومه", section: "resume" },
  { href: "/candidate/preferences", label: "ترجیحات شغلی", section: "preferences" },
  { href: "/candidate/applications", label: "درخواست‌های من", section: "applications" },
  { href: "/candidate/saved-jobs", label: "آگهی‌های ذخیره‌شده", section: "saved-jobs" },
  { href: "/candidate/notifications", label: "اعلان‌ها", section: "notifications" },
  { href: "/candidate/privacy", label: "درخواست‌های داده", section: "privacy" },
  { href: "/candidate/legal/acceptance", label: "قوانین و حریم خصوصی", section: "legal" },
];

function CandidateNavigationLinks({ current, savedJobsEnabled, mobile = false }: {
  current: CandidateSection;
  savedJobsEnabled: boolean;
  mobile?: boolean;
}) {
  return navigationItems
    .filter((item) => item.section !== "saved-jobs" || savedJobsEnabled)
    .map((item) => {
      const active = item.section === current;
      return <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={buttonClassNames({
          variant: active ? "primary" : "secondary",
          size: "small",
          className: mobile ? "min-h-11 w-full justify-start text-start" : "min-h-10",
        })}
      >{item.label}</Link>;
    });
}

export async function CandidateShell({ children, current }: CandidateShellProps) {
  const identity = await getBrowserNavigationIdentity();
  const displayName = identity?.role === "candidate" ? identity.displayName : "حساب کارجو";
  const savedJobsEnabled = isCandidateSavedJobsEnabled();
  const currentLabel = navigationItems.find((item) => item.section === current)?.label ?? "منوی کارجو";

  return <div className="min-h-screen overflow-x-clip bg-page">
    <header className="border-b border-ui-border bg-surface">
      <Container className="flex min-h-20 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/candidate" aria-label="خانه کارجو" className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus/30"><BrandLogo className="w-20" /></Link>
          <div className="min-w-0"><p className="text-meta">پنل کارجو</p><p className="max-w-36 truncate text-sm font-bold text-text-primary sm:max-w-64" dir="auto">{displayName}</p></div>
        </div>
        <form action={logoutCandidate} className="shrink-0"><Button type="submit" variant="ghost" size="small" className="min-h-11">خروج</Button></form>
      </Container>
    </header>
    <Container className="min-w-0 py-6 sm:py-12">
      <nav aria-label="ناوبری پنل کارجو" className="mb-6 sm:mb-8">
        <details className="group rounded-lg border border-ui-border bg-surface p-2 sm:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus/30">
            <span className="min-w-0 truncate">{currentLabel}</span><span aria-hidden="true" className="shrink-0 text-lg transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 grid gap-2 border-t border-ui-border pt-2">
            <CandidateNavigationLinks current={current} savedJobsEnabled={savedJobsEnabled} mobile />
          </div>
        </details>
        <div className="hidden flex-wrap gap-2 sm:flex"><CandidateNavigationLinks current={current} savedJobsEnabled={savedJobsEnabled} /></div>
      </nav>
      {children}
    </Container>
  </div>;
}
