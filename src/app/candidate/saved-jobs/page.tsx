import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { SaveJobControl } from "@/components/jobs/save-job-control";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";
import { getCandidateSavedJobs } from "@/saved-jobs/queries";
import { isCandidateSavedJobsEnabled, parseSavedJobsPage } from "@/saved-jobs/policy";

export const metadata: Metadata = { title: "آگهی‌های ذخیره‌شده" };
interface PageProps { searchParams: Promise<{ page?: string | string[] }>; }
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export default async function CandidateSavedJobsPage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  if (!isCandidateSavedJobsEnabled()) {
    return <CandidateShell current="saved-jobs"><Card className="mx-auto max-w-3xl text-center shadow-none"><h1 className="text-section-title">آگهی‌های ذخیره‌شده هنوز فعال نشده است</h1><p className="text-secondary mt-3">پس از آماده‌شدن زیرساخت، این بخش در پنل شما نمایش داده می‌شود.</p><Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده فرصت‌های شغلی</Link></Card></CandidateShell>;
  }
  const query = await searchParams;
  const result = await getCandidateSavedJobs(candidate.id, parseSavedJobsPage(query.page));
  return <CandidateShell current="saved-jobs"><div className="mx-auto max-w-5xl">
    <header><p className="text-meta">فرصت‌های موردعلاقه</p><h1 className="text-page-title mt-2">آگهی‌های ذخیره‌شده</h1><p className="text-secondary mt-3">فرصت‌هایی را که می‌خواهید بعداً دوباره بررسی کنید، اینجا مدیریت کنید.</p></header>
    {result.jobs.length ? <section aria-label="فهرست آگهی‌های ذخیره‌شده" className="mt-8 grid gap-4 md:grid-cols-2">{result.jobs.map((job) => <Card key={job.jobPostId} className="flex h-full flex-col shadow-none"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-card-title break-words">{job.title}</h2><p className="text-secondary mt-1 font-medium">{job.companyName}</p>{job.location ? <p className="text-helper mt-2">{job.location}</p> : null}</div><Badge variant={job.isPublic ? "success" : "neutral"}>{job.isPublic ? "فعال" : "غیرفعال"}</Badge></div><div className="mt-4 flex flex-wrap gap-2">{job.workplaceType ? <Badge>{workplaceTypeLabels[job.workplaceType]}</Badge> : null}{job.employmentType ? <Badge>{employmentTypeLabels[job.employmentType]}</Badge> : null}{job.seniorityLevel ? <Badge>{seniorityLevelLabels[job.seniorityLevel]}</Badge> : null}</div><time className="text-helper mt-4" dateTime={job.savedAt.toISOString()}>ذخیره‌شده در {dateFormatter.format(job.savedAt)}</time><div className="mt-auto flex flex-wrap items-start justify-between gap-3 border-t border-ui-border pt-4"><SaveJobControl jobPostId={job.jobPostId} initiallySaved />{job.isPublic ? <Link href={`/jobs/${job.jobPostId}`} className={buttonClassNames({ variant: "secondary", size: "small" })}>مشاهده آگهی</Link> : <span className="text-sm text-text-secondary">این آگهی دیگر عمومی نیست.</span>}</div></Card>)}</section> : <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">هنوز آگهی‌ای ذخیره نکرده‌اید</h2><p className="text-secondary mt-2">در فهرست فرصت‌ها، آگهی‌های موردنظر خود را ذخیره کنید.</p><Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده فرصت‌های شغلی</Link></Card>}
    {result.pageCount > 1 ? <nav aria-label="صفحه‌بندی آگهی‌های ذخیره‌شده" className="mt-7 flex items-center justify-between gap-3">{result.page > 1 ? <Link href={`/candidate/saved-jobs?page=${result.page - 1}`} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}<span className="text-sm text-text-secondary">صفحه {result.page.toLocaleString("fa-IR")} از {result.pageCount.toLocaleString("fa-IR")}</span>{result.page < result.pageCount ? <Link href={`/candidate/saved-jobs?page=${result.page + 1}`} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : null}</nav> : null}
  </div></CandidateShell>;
}
