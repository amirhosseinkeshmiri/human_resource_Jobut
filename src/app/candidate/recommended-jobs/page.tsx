import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { RecommendedJobCard } from "@/components/jobs/recommended-job-card";
import { Card, buttonClassNames } from "@/components/ui";
import { getCandidateRecommendedJobs } from "@/recommendations/queries";
import { isCandidateSavedJobsEnabled } from "@/saved-jobs/policy";
import { getCandidateSavedJobIds } from "@/saved-jobs/queries";

export const metadata: Metadata = { title: "آگهی‌های پیشنهادی" };

export default async function CandidateRecommendedJobsPage() {
  const candidate = await requireCandidate();
  let result;
  try {
    result = await getCandidateRecommendedJobs(candidate.id);
  } catch (error) {
    console.error(JSON.stringify({ event: "candidate_recommendations_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    result = { state: "unavailable" as const, recommendations: [] };
  }
  const savingEnabled = isCandidateSavedJobsEnabled();
  const savedJobIds = savingEnabled && result.state === "ready"
    ? await getCandidateSavedJobIds(candidate.id, result.recommendations.map((job) => job.id))
    : new Set<string>();

  return <CandidateShell current="recommended-jobs"><div className="mx-auto max-w-5xl"><div><p className="text-meta">پیشنهادهای مرتبط با پروفایل شما</p><h1 className="text-page-title mt-2">فرصت‌های شغلی پیشنهادی برای شما</h1><p className="text-secondary mt-3">این پیشنهادها به‌صورت قطعی و قابل توضیح از مهارت‌های رزومه و ترجیحات ثبت‌شده مرتب می‌شوند و تضمین استخدام نیستند.</p></div>
    {result.state === "no-resume" ? <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">برای دریافت پیشنهاد، رزومه خود را تکمیل کنید</h2><p className="text-secondary mt-2">مهارت‌های رزومه، مهم‌ترین معیار پیشنهاد فرصت‌های شغلی مرتبط هستند.</p><Link href="/candidate/resume" className={buttonClassNames({ className: "mt-5" })}>تکمیل رزومه</Link></Card> : null}
    {result.state === "no-skills" ? <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">مهارت‌های رزومه را تکمیل کنید</h2><p className="text-secondary mt-2">با افزودن مهارت‌ها می‌توانیم فرصت‌های مرتبط‌تری پیشنهاد کنیم.</p><Link href="/candidate/resume?mode=edit" className={buttonClassNames({ className: "mt-5" })}>ویرایش رزومه</Link></Card> : null}
    {result.state === "ready" && result.recommendations.length ? <section aria-label="فهرست آگهی‌های پیشنهادی" className="mt-8 grid gap-4 md:grid-cols-2">{result.recommendations.map((job) => <RecommendedJobCard key={job.id} job={job} savingEnabled={savingEnabled} saved={savedJobIds.has(job.id)} />)}</section> : null}
    {result.state === "ready" && !result.recommendations.length ? <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">در حال حاضر پیشنهاد مناسبی پیدا نشد</h2><p className="text-secondary mt-2">می‌توانید همه فرصت‌های شغلی فعال را ببینید یا ترجیحات و مهارت‌های خود را به‌روز کنید.</p><div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><Link href="/jobs" className={buttonClassNames()}>مشاهده همه فرصت‌های شغلی</Link><Link href="/candidate/preferences" className={buttonClassNames({ variant: "secondary" })}>ویرایش ترجیحات</Link><Link href="/candidate/resume?mode=edit" className={buttonClassNames({ variant: "secondary" })}>ویرایش رزومه</Link></div></Card> : null}
    {result.state === "unavailable" ? <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">پیشنهادها موقتاً در دسترس نیستند</h2><p className="text-secondary mt-2">می‌توانید فرصت‌های شغلی فعال را مشاهده کنید و بعداً دوباره به این صفحه برگردید.</p><Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده همه فرصت‌های شغلی</Link></Card> : null}
  </div></CandidateShell>;
}
