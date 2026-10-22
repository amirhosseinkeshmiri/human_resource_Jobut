import type { Metadata } from "next";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { JobPreferencesForm } from "@/components/candidate/job-preferences-form";
import { saveCandidateJobPreferences } from "@/preferences/actions";
import { getCandidateJobPreferences } from "@/preferences/queries";

export const metadata: Metadata = { title: "ترجیحات شغلی" };

interface PageProps {
  searchParams: Promise<{ saved?: string | string[]; error?: string | string[] }>;
}

export default async function CandidatePreferencesPage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const [preferences, query] = await Promise.all([
    getCandidateJobPreferences(candidate.id),
    searchParams,
  ]);
  const saved = (Array.isArray(query.saved) ? query.saved[0] : query.saved) === "1";
  const invalid = (Array.isArray(query.error) ? query.error[0] : query.error) === "invalid";

  return <CandidateShell current="preferences"><div className="mx-auto max-w-3xl">{saved ? <p role="status" className="mb-5 rounded-md border border-success/30 bg-success/5 p-3 text-sm font-semibold text-success">ترجیحات شغلی با موفقیت ذخیره شد.</p> : null}<div className="mb-7"><p className="text-meta">پیشنهادهای مرتبط‌تر</p><h1 className="text-page-title mt-2">ترجیحات شغلی</h1><p className="text-secondary mt-3">این اطلاعات خصوصی است و فقط برای بهترشدن پیشنهادهای شغلی شما استفاده می‌شود. همه بخش‌ها اختیاری‌اند.</p></div><JobPreferencesForm action={saveCandidateJobPreferences} preferences={preferences} serverError={invalid ? "اطلاعات ارسالی معتبر نبود. لطفاً گزینه‌ها را بررسی کنید." : undefined} /></div></CandidateShell>;
}
