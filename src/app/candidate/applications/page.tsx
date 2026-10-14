import type { Metadata } from "next";
import Link from "next/link";
import { getCandidateApplications } from "@/applications/queries";
import { applicationStatusLabels } from "@/applications/status-policy";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Badge, Card, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = { title: "درخواست‌های من" };
interface PageProps { searchParams: Promise<{ applied?: string | string[] }>; }
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

export default async function CandidateApplicationsPage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const [applications, query] = await Promise.all([getCandidateApplications(candidate.id), searchParams]);
  const applied = (Array.isArray(query.applied) ? query.applied[0] : query.applied) === "1";

  return <CandidateShell current="applications"><div className="mx-auto max-w-4xl">{applied ? <p role="status" className="mb-5 rounded-md border border-success/30 bg-success/5 p-3 text-sm font-semibold text-success">درخواست شما با موفقیت ارسال شد.</p> : null}<div><p className="text-meta">سوابق ارسال رزومه</p><h1 className="text-page-title mt-2">درخواست‌های من</h1><p className="text-secondary mt-3">فهرست درخواست‌هایی که با رزومه شبکه استخدامی متخصصین آکادمیک ارسال کرده‌اید.</p></div>{applications.length ? <div className="mt-8 grid gap-3">{applications.map((application) => <Card key={application.id} className="shadow-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-card-title">{application.jobTitle}</h2><p className="text-secondary mt-1">{application.companyName}</p></div><div className="flex flex-wrap gap-2"><Badge>{applicationStatusLabels[application.applicationStatus]}</Badge><Badge variant={application.isPublic ? "success" : "neutral"}>{application.isPublic ? "آگهی فعال" : "آگهی غیرفعال"}</Badge></div></div><p className="text-helper mt-4">ارسال‌شده در {dateFormatter.format(application.createdAt)}</p>{application.isPublic ? <Link href={`/jobs/${application.jobPostId}`} className={buttonClassNames({ variant: "secondary", size: "small", className: "mt-4" })}>مشاهده آگهی</Link> : <p className="text-secondary mt-4">این آگهی دیگر فعال نیست.</p>}</Card>)}</div> : <Card className="mt-8 text-center shadow-none"><h2 className="text-card-title">هنوز درخواستی ارسال نکرده‌اید</h2><p className="text-secondary mt-2">آگهی‌های فعال را ببینید و رزومه خود را ارسال کنید.</p><Link href="/jobs" className={buttonClassNames({ className: "mt-5" })}>مشاهده آگهی‌ها</Link></Card>}</div></CandidateShell>;
}
