import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Card, buttonClassNames } from "@/components/ui";
import { candidateHasResume } from "@/resume/queries";

export const metadata: Metadata = { title: "پنل کارجو" };

export default async function CandidateDashboardPage() {
  const candidate = await requireCandidate();
  const hasResume = await candidateHasResume(candidate.id);

  return (
    <CandidateShell current="home">
        <div className="max-w-3xl">
          <p className="text-meta">پنل کارجو</p>
          <h1 className="text-page-title mt-2">خوش آمدید</h1>
          <p className="text-secondary mt-3">از این بخش می‌توانید فرصت‌های شغلی فعال جاب یوتی را مشاهده کنید.</p>
          <Card className="mt-8 shadow-none">
            <h2 className="text-card-title">فرصت‌های شغلی</h2>
            <p className="text-secondary mt-2">مشاهده فرصت‌ها برای همه کاربران آزاد است و به ورود نیاز ندارد.</p>
            <Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده فرصت‌های شغلی</Link>
          </Card>
          <Card className="mt-4 shadow-none">
            <h2 className="text-card-title">رزومه</h2>
            <p className="text-secondary mt-2">{hasResume ? "رزومه تکمیل شده و آماده ویرایش است." : "رزومه تکمیل نشده است."}</p>
            <Link href="/candidate/resume" className={buttonClassNames({ variant: hasResume ? "secondary" : "primary", className: "mt-5" })}>{hasResume ? "مشاهده و ویرایش رزومه" : "ساخت رزومه"}</Link>
          </Card>
        </div>
    </CandidateShell>
  );
}
