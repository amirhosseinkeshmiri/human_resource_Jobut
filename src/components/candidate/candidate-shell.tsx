import type { ReactNode } from "react";
import Link from "next/link";
import { logoutCandidate } from "@/candidate-auth/actions";
import { Button, Container, buttonClassNames } from "@/components/ui";

interface CandidateShellProps {
  children: ReactNode;
  current: "home" | "resume" | "applications";
}

export function CandidateShell({ children, current }: CandidateShellProps) {
  return <div className="min-h-screen bg-page"><header className="border-b border-ui-border bg-surface"><Container className="flex min-h-16 items-center justify-between gap-4"><Link href="/candidate" className="text-lg font-bold outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">جاب یوتی</Link><form action={logoutCandidate}><Button type="submit" variant="ghost" size="small">خروج</Button></form></Container></header><Container className="py-8 sm:py-12"><nav aria-label="ناوبری پنل کارجو" className="mb-8 flex flex-wrap gap-2"><Link href="/candidate" aria-current={current === "home" ? "page" : undefined} className={buttonClassNames({ variant: current === "home" ? "primary" : "secondary", size: "small" })}>خانه</Link><Link href="/jobs" className={buttonClassNames({ variant: "secondary", size: "small" })}>فرصت‌های شغلی</Link><Link href="/candidate/resume" aria-current={current === "resume" ? "page" : undefined} className={buttonClassNames({ variant: current === "resume" ? "primary" : "secondary", size: "small" })}>رزومه</Link><Link href="/candidate/applications" aria-current={current === "applications" ? "page" : undefined} className={buttonClassNames({ variant: current === "applications" ? "primary" : "secondary", size: "small" })}>درخواست‌های من</Link></nav>{children}</Container></div>;
}
