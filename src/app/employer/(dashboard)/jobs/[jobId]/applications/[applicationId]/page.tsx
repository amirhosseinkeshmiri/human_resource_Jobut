import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployerApplicantResume } from "@/applicants/queries";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { jobStatusLabels } from "@/jobs/policy";
import { languageProficiencyLabels } from "@/resume/validation";

export const metadata: Metadata = { title: "مشاهده رزومه متقاضی" };
interface PageProps { params: Promise<{ jobId: string; applicationId: string }>; }
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", timeZone: "UTC" });
const submittedFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
function formatDate(value: string) { return dateFormatter.format(new Date(`${value}T00:00:00.000Z`)); }

export default async function EmployerApplicantResumePage({ params }: PageProps) {
  const [{ jobId, applicationId }, { company }] = await Promise.all([params, getEmployerDashboardContext()]);
  const resume = await getEmployerApplicantResume(company.id, jobId, applicationId);
  if (!resume) notFound();

  return <div className="mx-auto max-w-4xl"><Link href={`/employer/jobs/${resume.jobId}/applications`} className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">بازگشت به درخواست‌ها</Link><Card className="mt-5 shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-meta">رزومه ارسال‌شده برای {resume.jobTitle}</p><h1 className="text-page-title mt-2">{resume.firstName} {resume.lastName}</h1><p className="mt-2 font-semibold text-action">{resume.professionalTitle}</p><p className="text-secondary mt-1">{resume.city}</p></div><Badge>{jobStatusLabels[resume.jobStatus]}</Badge></div><p className="text-helper mt-5">تاریخ ارسال درخواست: {submittedFormatter.format(resume.applicationCreatedAt)}</p><p className="text-body mt-6 whitespace-pre-wrap text-text-secondary">{resume.professionalSummary}</p></Card>
    <Card className="mt-5 shadow-none"><h2 className="text-section-title">مهارت‌ها</h2><div className="mt-4 flex flex-wrap gap-2">{resume.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div></Card>
    {resume.experiences.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">سوابق شغلی</h2><div className="mt-5 grid gap-5">{resume.experiences.map((item, index) => <article key={`${item.jobTitle}-${index}`} className="border-b border-ui-border pb-5 last:border-0 last:pb-0"><h3 className="font-bold">{item.jobTitle}</h3><p className="text-secondary mt-1">{item.companyName}</p><p className="text-helper mt-2">{formatDate(item.startDate)} تا {item.isCurrent ? "اکنون" : item.endDate ? formatDate(item.endDate) : "—"}</p>{item.description ? <p className="text-body mt-3 whitespace-pre-wrap text-text-secondary">{item.description}</p> : null}</article>)}</div></Card> : null}
    {resume.educations.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">تحصیلات</h2><div className="mt-5 grid gap-5">{resume.educations.map((item, index) => <article key={`${item.fieldOfStudy}-${index}`} className="border-b border-ui-border pb-5 last:border-0 last:pb-0"><h3 className="font-bold">{item.fieldOfStudy} · {item.degree}</h3><p className="text-secondary mt-1">{item.institutionName}</p><p className="text-helper mt-2">{formatDate(item.startDate)} تا {item.isCurrent ? "اکنون" : item.endDate ? formatDate(item.endDate) : "—"}</p></article>)}</div></Card> : null}
    {resume.languages.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">زبان‌ها</h2><div className="mt-4 flex flex-wrap gap-2">{resume.languages.map((item) => <Badge key={item.name}>{item.name} · {languageProficiencyLabels[item.proficiency]}</Badge>)}</div></Card> : null}
    {resume.linkedinUrl || resume.portfolioUrl ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">لینک‌های حرفه‌ای</h2><div className="mt-4 flex flex-wrap gap-4">{resume.linkedinUrl ? <a href={resume.linkedinUrl} target="_blank" rel="noreferrer" className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">مشاهده لینکدین<span className="sr-only"> (در پنجره جدید)</span></a> : null}{resume.portfolioUrl ? <a href={resume.portfolioUrl} target="_blank" rel="noreferrer" className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">مشاهده نمونه‌کار<span className="sr-only"> (در پنجره جدید)</span></a> : null}</div></Card> : null}
    <Card className="mt-5 border-dashed shadow-none"><p className="text-helper">این صفحه نسخه فعلی رزومه ساختاریافته کارجو را نمایش می‌دهد؛ در این مرحله نسخه ثابت تاریخی از رزومه نگهداری نمی‌شود.</p></Card><Link href={`/employer/jobs/${resume.jobId}/applications`} className={buttonClassNames({ variant: "secondary", className: "mt-6" })}>بازگشت به متقاضیان</Link>
  </div>;
}
