import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveEmployerApplicationNote, transitionApplicationStatus } from "@/applicants/actions";
import { getEmployerApplicantResume } from "@/applicants/queries";
import {
  applicationStatusLabels,
  getAllowedApplicationTransitions,
  isTerminalApplicationStatus,
  type ApplicationStatus,
} from "@/applications/status-policy";
import { APPLICATION_SUBMISSION_TIMELINE_LABEL } from "@/applications/status-history-policy";
import { Badge, Button, Card, FormField, Textarea, buttonClassNames } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { jobStatusLabels } from "@/jobs/policy";
import { languageProficiencyLabels } from "@/resume/validation";
import { markEmployerMessagesRead, sendEmployerApplicationMessage } from "@/messages/actions";
import { getApplicationMessagesForEmployer } from "@/messages/domain";
import { ApplicationMessageThread } from "@/messages/message-thread";
import { canSendApplicationMessage } from "@/messages/policy";

export const metadata: Metadata = { title: "مشاهده رزومه متقاضی" };
interface PageProps {
  params: Promise<{ jobId: string; applicationId: string }>;
  searchParams: Promise<{ transition?: string | string[]; note?: string | string[]; message?: string | string[] }>;
}
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", timeZone: "UTC" });
const submittedFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
const historyFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });
function formatDate(value: string) { return dateFormatter.format(new Date(`${value}T00:00:00.000Z`)); }

function transitionLabel(current: ApplicationStatus, target: ApplicationStatus) {
  if (target === "rejected") return "رد درخواست";
  if (target === "hired") return "ثبت استخدام";
  if (target === "received") return "بازگشت به دریافت‌شده";
  if (target === "interview") return "انتقال به مصاحبه";
  return current === "interview" ? "بازگشت به در حال بررسی" : "شروع بررسی";
}

export default async function EmployerApplicantResumePage({ params, searchParams }: PageProps) {
  const [{ jobId, applicationId }, query, { company, employer }] = await Promise.all([params, searchParams, getEmployerDashboardContext()]);
  const resume = await getEmployerApplicantResume(company.id, jobId, applicationId);
  if (!resume) notFound();
  const thread = await getApplicationMessagesForEmployer({ employerAccountId: employer.id, companyId: company.id, applicationId });
  if (!thread) notFound();
  const transitionValue = Array.isArray(query.transition) ? query.transition[0] : query.transition;
  const transitionMessage = transitionValue === "stale"
    ? "وضعیت درخواست هم‌زمان تغییر کرده است. صفحه را دوباره بررسی کنید."
    : transitionValue === "invalid"
      ? "این تغییر وضعیت مجاز نیست."
      : transitionValue === "error"
        ? "تغییر وضعیت انجام نشد. دوباره تلاش کنید."
      : null;
  const allowedTransitions = getAllowedApplicationTransitions(resume.applicationStatus);
  const noteValue = Array.isArray(query.note) ? query.note[0] : query.note;
  const noteMessage = noteValue === "saved"
    ? { role: "status" as const, text: "یادداشت داخلی ذخیره شد.", className: "border-success/30 bg-success/5 text-success" }
    : noteValue === "validation"
      ? { role: "alert" as const, text: "یادداشت نباید بیشتر از ۲۰۰۰ نویسه باشد.", className: "border-danger/30 bg-danger/5 text-danger" }
      : noteValue === "persistence"
        ? { role: "alert" as const, text: "ذخیره یادداشت انجام نشد. دوباره تلاش کنید.", className: "border-danger/30 bg-danger/5 text-danger" }
        : null;
  const applicantName = resume.snapshotAvailable
    ? `${resume.firstName} ${resume.lastName}`
    : "درخواست قدیمی";
  const messageOutcome = Array.isArray(query.message) ? query.message[0] : query.message;

  return <div className="mx-auto max-w-4xl"><Link href={`/employer/jobs/${resume.jobId}/applications`} className="text-sm font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">بازگشت به درخواست‌ها</Link>{transitionMessage ? <p role="alert" className="mt-5 rounded-md border border-danger/20 bg-danger/5 p-3 text-sm font-semibold text-danger">{transitionMessage}</p> : null}<Card className="mt-5 shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-meta">رزومه ارسال‌شده برای {resume.jobTitle}</p><h1 className="text-page-title mt-2">{applicantName}</h1>{resume.snapshotAvailable ? <><p className="mt-2 font-semibold text-action">{resume.professionalTitle}</p><p className="text-secondary mt-1">{resume.city}</p></> : <p className="text-secondary mt-2">این درخواست پیش از فعال‌شدن snapshot ثبت شده و نسخه تاریخی قابل اتکایی از رزومه آن موجود نیست.</p>}</div><div className="flex flex-wrap gap-2"><Badge>{applicationStatusLabels[resume.applicationStatus]}</Badge><Badge>{jobStatusLabels[resume.jobStatus]}</Badge></div></div><p className="text-helper mt-5">تاریخ ارسال درخواست: {submittedFormatter.format(resume.applicationCreatedAt)}</p>{resume.professionalSummary ? <p className="text-body mt-6 whitespace-pre-wrap text-text-secondary">{resume.professionalSummary}</p> : null}</Card>
    <Card className="mt-5 shadow-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-meta">وضعیت فرایند جذب</p><h2 className="text-card-title mt-1">{applicationStatusLabels[resume.applicationStatus]}</h2></div><Badge>{applicationStatusLabels[resume.applicationStatus]}</Badge></div>{allowedTransitions.length ? <div className="mt-5 flex flex-wrap gap-2">{allowedTransitions.map((target) => <form key={target} action={transitionApplicationStatus}><input type="hidden" name="jobId" value={resume.jobId} /><input type="hidden" name="applicationId" value={resume.applicationId} /><input type="hidden" name="targetStatus" value={target} /><button type="submit" className={buttonClassNames({ variant: target === "rejected" ? "destructive" : target === "received" || target === "reviewing" && resume.applicationStatus === "interview" ? "secondary" : "primary", size: "small" })}>{transitionLabel(resume.applicationStatus, target)}</button></form>)}</div> : <p className="text-secondary mt-4">این وضعیت نهایی است و اقدام دیگری ندارد.</p>}{isTerminalApplicationStatus(resume.applicationStatus) ? <p className="text-helper mt-3">وضعیت‌های رد شده و استخدام شده در این مرحله قابل تغییر نیستند.</p> : null}</Card>
    <Card className="mt-5 shadow-none"><h2 className="text-section-title">تاریخچه وضعیت</h2><ol className="mt-5 grid gap-4 border-s-2 border-ui-border ps-5"><li className="relative"><span aria-hidden="true" className="absolute -start-[1.7rem] top-1.5 size-3 rounded-full bg-action ring-4 ring-surface" /><p className="text-label">{APPLICATION_SUBMISSION_TIMELINE_LABEL}</p><time className="text-helper mt-1 block" dateTime={resume.applicationCreatedAt.toISOString()}>{historyFormatter.format(resume.applicationCreatedAt)}</time></li>{resume.statusHistory.map((item) => <li key={item.id} className="relative"><span aria-hidden="true" className="absolute -start-[1.7rem] top-1.5 size-3 rounded-full bg-accent ring-4 ring-surface" /><p className="text-label">از «{applicationStatusLabels[item.fromStatus]}» به «{applicationStatusLabels[item.toStatus]}»</p><time className="text-helper mt-1 block" dateTime={item.changedAt.toISOString()}>{historyFormatter.format(item.changedAt)}</time></li>)}</ol>{resume.statusHistory.length === 0 ? <p className="text-secondary mt-4">پس از ارسال درخواست، هنوز تغییری در وضعیت ثبت نشده است.</p> : null}</Card>
    <Card className="mt-5 shadow-none"><h2 className="text-section-title">یادداشت داخلی</h2><p className="text-helper mt-2">این یادداشت فقط در بخش کارفرما و برای بررسی داخلی این درخواست قابل مشاهده است.</p>{noteMessage ? <p role={noteMessage.role} className={`mt-4 rounded-md border p-3 text-sm ${noteMessage.className}`}>{noteMessage.text}</p> : null}{resume.employerNote ? <p className="text-body mt-4 whitespace-pre-wrap rounded-md bg-surface-elevated p-3 text-text-secondary">{resume.employerNote}</p> : <p className="text-secondary mt-4">هنوز یادداشتی ثبت نشده است.</p>}<form action={saveEmployerApplicationNote} className="mt-5 grid gap-4"><input type="hidden" name="jobId" value={resume.jobId} /><input type="hidden" name="applicationId" value={resume.applicationId} /><FormField id="employer-note" label="متن یادداشت" hint="حداکثر ۲۰۰۰ نویسه؛ ذخیره متن خالی یادداشت را پاک می‌کند."><Textarea name="note" rows={6} maxLength={2000} defaultValue={resume.employerNote ?? ""} className="min-h-36" /></FormField><Button type="submit" className="w-full sm:w-fit">ذخیره یادداشت</Button></form></Card>
    {resume.skills ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">مهارت‌ها</h2><div className="mt-4 flex flex-wrap gap-2">{resume.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div></Card> : null}
    {resume.experiences.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">سوابق شغلی</h2><div className="mt-5 grid gap-5">{resume.experiences.map((item, index) => <article key={`${item.jobTitle}-${index}`} className="border-b border-ui-border pb-5 last:border-0 last:pb-0"><h3 className="font-bold">{item.jobTitle}</h3><p className="text-secondary mt-1">{item.companyName}</p><p className="text-helper mt-2">{formatDate(item.startDate)} تا {item.isCurrent ? "اکنون" : item.endDate ? formatDate(item.endDate) : "—"}</p>{item.description ? <p className="text-body mt-3 whitespace-pre-wrap text-text-secondary">{item.description}</p> : null}</article>)}</div></Card> : null}
    {resume.educations.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">تحصیلات</h2><div className="mt-5 grid gap-5">{resume.educations.map((item, index) => <article key={`${item.fieldOfStudy}-${index}`} className="border-b border-ui-border pb-5 last:border-0 last:pb-0"><h3 className="font-bold">{item.fieldOfStudy} · {item.degree}</h3><p className="text-secondary mt-1">{item.institutionName}</p><p className="text-helper mt-2">{formatDate(item.startDate)} تا {item.isCurrent ? "اکنون" : item.endDate ? formatDate(item.endDate) : "—"}</p></article>)}</div></Card> : null}
    {resume.languages.length ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">زبان‌ها</h2><div className="mt-4 flex flex-wrap gap-2">{resume.languages.map((item) => <Badge key={item.name}>{item.name} · {languageProficiencyLabels[item.proficiency]}</Badge>)}</div></Card> : null}
    {resume.linkedinUrl || resume.portfolioUrl ? <Card className="mt-5 shadow-none"><h2 className="text-section-title">لینک‌های حرفه‌ای</h2><div className="mt-4 flex flex-wrap gap-4">{resume.linkedinUrl ? <a href={resume.linkedinUrl} target="_blank" rel="noreferrer" className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">مشاهده لینکدین<span className="sr-only"> (در پنجره جدید)</span></a> : null}{resume.portfolioUrl ? <a href={resume.portfolioUrl} target="_blank" rel="noreferrer" className="font-semibold text-action outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">مشاهده نمونه‌کار<span className="sr-only"> (در پنجره جدید)</span></a> : null}</div></Card> : null}
    <ApplicationMessageThread applicationId={applicationId} jobId={jobId} viewerRole="employer" messages={thread.messages} outcome={messageOutcome} sendAction={sendEmployerApplicationMessage} markReadAction={markEmployerMessagesRead} canSend={canSendApplicationMessage({ applicationStatus: thread.status, jobStatus: thread.jobStatus, senderRole: "employer", kind: "recruitment_message", hasEmployerMessage: true })} />
    <Card className="mt-5 border-dashed shadow-none"><p className="text-helper">{resume.snapshotAvailable ? "این صفحه نسخه ثابت رزومه در زمان ارسال درخواست را نمایش می‌دهد و با ویرایش رزومه فعلی تغییر نمی‌کند." : "برای این درخواست قدیمی هیچ نسخه تاریخی قابل اتکایی ساخته نشده است؛ رزومه فعلی به‌عنوان تاریخچه نمایش داده نمی‌شود."}</p></Card><Link href={`/employer/jobs/${resume.jobId}/applications`} className={buttonClassNames({ variant: "secondary", className: "mt-6" })}>بازگشت به متقاضیان</Link>
  </div>;
}
