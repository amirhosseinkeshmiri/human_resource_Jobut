import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { transitionApplicationStatus } from "@/applicants/actions";
import { getEmployerApplicantResume } from "@/applicants/queries";
import {
  applicationStatusLabels,
  getAllowedApplicationTransitions,
  isTerminalApplicationStatus,
  type ApplicationStatus,
} from "@/applications/status-policy";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { jobStatusLabels } from "@/jobs/policy";
import { languageProficiencyLabels } from "@/resume/validation";

export const metadata: Metadata = { title: "مشاهده رزومه متقاضی" };
interface PageProps {
  params: Promise<{ jobId: string; applicationId: string }>;
  searchParams: Promise<{ transition?: string | string[] }>;
}
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", timeZone: "UTC" });
const submittedFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
function formatDate(value: string) { return dateFormatter.format(new Date(`${value}T00:00:00.000Z`)); }

function transitionLabel(current: ApplicationStatus, target: ApplicationStatus) {
  if (target === "rejected") return "رد درخواست";
  if (target === "hired") return "ثبت استخدام";
  if (target === "received") return "بازگشت به دریافت‌شده";
  if (target === "interview") return "انتقال به مصاحبه";
  return current === "interview" ? "بازگشت به در حال بررسی" : "شروع بررسی";
}

export default async function EmployerApplicantResumePage({ params, searchParams }: PageProps) {
  const [{ jobId, applicationId }, query, { company }] = await Promise.all([params, searchParams, getEmployerDashboardContext()]);
  const resume = await getEmployerApplicantResume(company.id, jobId, applicationId);
  if (!resume) notFound();
  const transitionValue = Array.isArray(query.transition) ? query.transition[0] : query.transition;
  const transitionMessage = transitionValue === "stale"
    ? "وضعیت درخواست هم‌زمان تغییر کرده است. صفحه را دوباره بررسی کنید."
    : transitionValue === "invalid"
      ? "این تغییر وضعیت مجاز نیست."
      : null;
  const allowedTransitions = getAllowedApplicationTransitions(resume.applicationStatus);

  return <div className="mx-auto max-w-4xl"><Link href={`/employer/jobs/${resume.jobId}/applications`} className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">بازگشت به درخواست‌ها</Link>{transitionMessage ? <p role="alert" className="mt-5 rounded-md border border-danger/20 bg-danger/5 p-3 text-sm font-semibold text-danger">{transitionMessage}</p> : null}<Card className="mt-5 shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-meta">رزومه ارسال‌شده برای {resume.jobTitle}</p><h1 className="text-page-title mt-2">{resume.firstName} {resume.lastName}</h1><p className="mt-2 font-semibold text-action">{resume.professionalTitle}</p><p className="text-secondary mt-1">{resume.city}</p></div><div className="flex flex-wrap gap-2"><Badge>{applicationStatusLabels[resume.applicationStatus]}</Badge><Badge>{jobStatusLabels[resume.jobStatus]}</Badge></div></div><p className="text-helper mt-5">تاریخ ارسال درخواست: {submittedFormatter.format(resume.applicationCreatedAt)}</p><p className="text-body mt-6 whitespace-pre-wrap text-text-secondary">{resume.professionalSummary}</p></Card>
    <Card className="mt-5 shadow-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-meta">وضعیت فرایند جذب</p><h2 className="text-card-title mt-1">{applicationStatusLabels[resume.applicationStatus]}</h2></div><Badge>{applicationStatusLabels[resume.applicationStatus]}</Badge></div>{allowedTransitions.length ? <div className="mt-5 flex flex-wrap gap-2">{allowedTransitions.map((target) => <form key={target} action={transitionApplicationStatus}><input type="hidden" name="jobId" value={resume.jobId} /><input type="hidden" name="applicationId" value={resume.applicationId} /><input type="hidden" name="targetStatus" value={target} /><button type="submit" className={buttonClassNames({ variant: target === "rejected" ? "destructive" : target === "received" || target === "reviewing" && resume.applicationStatus === "interview" ? "secondary" : "primary", size: "small" })}>{transitionLabel(resume.applicationStatus, target)}</button></form>)}</div> : <p className="text-secondary mt-4">این وضعیت نهایی است و اقدام دیگری ندارد.</p>}{isTerminalApplicationStatus(resume.applicationStatus) ? <p className="text-helper mt-3">وضعیت‌های رد شده و استخدام شده در این مرحله قابل تغییر نیستند.</p> : null}</Card>
    <Card className="mt-5 shadow-none"><h2 className="text-section-title">مهارت‌ها</h2><div className="mt-4 flex flex-wrap gap-2">{resume.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div></Card>
    {resume.experiences.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">سوابق شغلی</h2><div className="mt-5 grid gap-5">{resume.experiences.map((item, index) => <article key={`${item.jobTitle}-${index}`} className="border-b border-ui-border pb-5 last:border-0 last:pb-0"><h3 className="font-bold">{item.jobTitle}</h3><p className="text-secondary mt-1">{item.companyName}</p><p className="text-helper mt-2">{formatDate(item.startDate)} تا {item.isCurrent ? "اکنون" : item.endDate ? formatDate(item.endDate) : "—"}</p>{item.description ? <p className="text-body mt-3 whitespace-pre-wrap text-text-secondary">{item.description}</p> : null}</article>)}</div></Card> : null}
    {resume.educations.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">تحصیلات</h2><div className="mt-5 grid gap-5">{resume.educations.map((item, index) => <article key={`${item.fieldOfStudy}-${index}`} className="border-b border-ui-border pb-5 last:border-0 last:pb-0"><h3 className="font-bold">{item.fieldOfStudy} · {item.degree}</h3><p className="text-secondary mt-1">{item.institutionName}</p><p className="text-helper mt-2">{formatDate(item.startDate)} تا {item.isCurrent ? "اکنون" : item.endDate ? formatDate(item.endDate) : "—"}</p></article>)}</div></Card> : null}
    {resume.languages.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">زبان‌ها</h2><div className="mt-4 flex flex-wrap gap-2">{resume.languages.map((item) => <Badge key={item.name}>{item.name} · {languageProficiencyLabels[item.proficiency]}</Badge>)}</div></Card> : null}
    {resume.linkedinUrl || resume.portfolioUrl ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">لینک‌های حرفه‌ای</h2><div className="mt-4 flex flex-wrap gap-4">{resume.linkedinUrl ? <a href={resume.linkedinUrl} target="_blank" rel="noreferrer" className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">مشاهده لینکدین<span className="sr-only"> (در پنجره جدید)</span></a> : null}{resume.portfolioUrl ? <a href={resume.portfolioUrl} target="_blank" rel="noreferrer" className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">مشاهده نمونه‌کار<span className="sr-only"> (در پنجره جدید)</span></a> : null}</div></Card> : null}
    <Card className="mt-5 border-dashed shadow-none"><p className="text-helper">این صفحه نسخه فعلی رزومه ساختاریافته کارجو را نمایش می‌دهد؛ در این مرحله نسخه ثابت تاریخی از رزومه نگهداری نمی‌شود.</p></Card><Link href={`/employer/jobs/${resume.jobId}/applications`} className={buttonClassNames({ variant: "secondary", className: "mt-6" })}>بازگشت به متقاضیان</Link>
  </div>;
}
