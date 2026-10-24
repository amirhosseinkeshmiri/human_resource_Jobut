import type { Metadata } from "next";
import Link from "next/link";
import { getCandidateApplications } from "@/applications/queries";
import { applicationStatusLabels, type ApplicationStatus } from "@/applications/status-policy";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Badge, Card, buttonClassNames, type BadgeProps } from "@/components/ui";
import { PUBLIC_JOBS_ROUTE } from "@/jobs/public-copy";

export const metadata: Metadata = { title: "درخواست‌های من" };
interface PageProps { searchParams: Promise<{ applied?: string | string[] }>; }
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

const statusVariants: Record<ApplicationStatus, BadgeProps["variant"]> = {
  received: "neutral",
  reviewing: "warning",
  interview: "warning",
  rejected: "danger",
  hired: "success",
};

export default async function CandidateApplicationsPage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const [applications, query] = await Promise.all([
    getCandidateApplications(candidate.id),
    searchParams,
  ]);
  const applied = (Array.isArray(query.applied) ? query.applied[0] : query.applied) === "1";

  return <CandidateShell current="applications"><div className="mx-auto max-w-5xl">
    {applied ? <p role="status" className="mb-5 rounded-md border border-success/30 bg-success/5 p-3 text-sm font-semibold text-success">درخواست شما با موفقیت ارسال شد.</p> : null}
    <header><p className="text-meta">پیگیری درخواست‌ها</p><h1 className="text-page-title mt-2">درخواست‌های من</h1><p className="text-secondary mt-3">وضعیت فعلی فرصت‌های شغلی‌ای را که برای آن‌ها رزومه ارسال کرده‌اید، دنبال کنید.</p></header>

    {applications.length ? <section aria-label="فهرست درخواست‌های شغلی" className="mt-8 grid gap-3">{applications.map((application) => <Card key={application.id} className="shadow-none transition-colors hover:border-action/20"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><h2 className="text-card-title break-words">{application.jobTitle}</h2><p className="text-secondary mt-1 font-medium">{application.companyName}</p>{application.jobLocation ? <p className="text-helper mt-2">{application.jobLocation}</p> : null}</div><div className="shrink-0"><p className="text-helper mb-2">وضعیت فعلی</p><Badge variant={statusVariants[application.applicationStatus]}>{applicationStatusLabels[application.applicationStatus]}</Badge></div></div><div className="mt-5 flex flex-col gap-3 border-t border-ui-border pt-4 sm:flex-row sm:items-center sm:justify-between"><time className="text-helper" dateTime={application.createdAt.toISOString()}>ارسال‌شده در {dateFormatter.format(application.createdAt)}</time><div className="flex flex-col gap-2 sm:flex-row"><Link href={`/candidate/applications/${application.id}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "w-full sm:w-auto" })}>{application.snapshotAvailable ? "رزومه ارسال‌شده" : "جزئیات درخواست قدیمی"}</Link>{application.isPublic ? <Link href={`/jobs/${application.jobPostId}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "w-full sm:w-auto" })}>مشاهده فرصت شغلی</Link> : <span className="text-sm text-text-secondary">این فرصت شغلی دیگر فعال نیست.</span>}</div></div></Card>)}</section> : <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">هنوز برای فرصت شغلی‌ای درخواست ارسال نکرده‌اید</h2><p className="text-secondary mt-2">فرصت‌های شغلی فعال را ببینید و رزومه خود را ارسال کنید.</p><Link href={PUBLIC_JOBS_ROUTE} className={buttonClassNames({ className: "mt-5" })}>مشاهده فرصت‌های شغلی</Link></Card>}
  </div></CandidateShell>;
}
