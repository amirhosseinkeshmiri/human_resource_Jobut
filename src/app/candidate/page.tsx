import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Card, buttonClassNames } from "@/components/ui";
import { candidateHasResume } from "@/resume/queries";
import { countCandidateApplications } from "@/applications/queries";

export const metadata: Metadata = { title: "پنل کارجو" };

export default async function CandidateDashboardPage() {
  const candidate = await requireCandidate();
  const [hasResume, applicationCount] = await Promise.all([
    candidateHasResume(candidate.id),
    countCandidateApplications(candidate.id),
  ]);

  return (
    <CandidateShell current="home">
        <div className="max-w-3xl">
          <p className="text-meta">پنل کارجو</p>
          <h1 className="text-page-title mt-2">خوش آمدید</h1>
          <p className="text-secondary mt-3">از این بخش می‌توانید آگهی‌های فعال شبکه استخدامی متخصصین آکادمیک را مشاهده کنید.</p>
          <Card className="mt-8 shadow-none">
            <h2 className="text-card-title">آگهی‌ها</h2>
            <p className="text-secondary mt-2">مشاهده فرصت‌ها برای همه کاربران آزاد است و به ورود نیاز ندارد.</p>
            <Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده آگهی‌ها</Link>
          </Card>
          <Card className="mt-4 shadow-none">
            <h2 className="text-card-title">رزومه</h2>
            <p className="text-secondary mt-2">{hasResume ? "رزومه تکمیل شده و آماده ویرایش است." : "رزومه تکمیل نشده است."}</p>
            <Link href="/candidate/resume" className={buttonClassNames({ variant: hasResume ? "secondary" : "primary", className: "mt-5" })}>{hasResume ? "مشاهده و ویرایش رزومه" : "ساخت رزومه"}</Link>
          </Card>
          <Card className="mt-4 shadow-none">
            <h2 className="text-card-title">درخواست‌های ارسال‌شده</h2>
            <p className="mt-3 text-2xl font-bold">{applicationCount.toLocaleString("fa-IR")}</p>
            <Link href="/candidate/applications" className={buttonClassNames({ variant: "secondary", className: "mt-5" })}>مشاهده درخواست‌های من</Link>
          </Card>
        </div>
    </CandidateShell>
  );
}
