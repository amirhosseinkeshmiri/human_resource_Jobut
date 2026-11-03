import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidateApplicationResumeSnapshot } from "@/applications/queries";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Card, buttonClassNames } from "@/components/ui";
import { markCandidateMessagesRead, sendCandidateApplicationMessage } from "@/messages/actions";
import { getApplicationMessagesForCandidate } from "@/messages/domain";
import { ApplicationMessageThread } from "@/messages/message-thread";
import { canSendApplicationMessage } from "@/messages/policy";
import { withdrawApplication } from "@/applications/withdrawal-actions";
import { canWithdrawApplication } from "@/applications/withdrawal-policy";
import { isCandidateApplicationWithdrawalEnabled } from "@/applications/status-policy";
import {
  getCandidateApplicationPublicIdentity,
  getCandidateVisibleStatusLabel,
  presentCandidateStatusHistory,
} from "@/applications/candidate-history-presentation";
import { credentialRecordTypeLabels } from "@/candidate-credentials/validation";

export const metadata: Metadata = { title: "رزومه ارسال‌شده" };
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeZone: "Asia/Tehran" });
const historyFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });

export default async function CandidateApplicationSnapshotPage({ params, searchParams }: { params: Promise<{ applicationId: string }>; searchParams: Promise<{ message?: string | string[]; withdrawal?: string | string[] }> }) {
  const candidate = await requireCandidate();
  const [{ applicationId }, query] = await Promise.all([params, searchParams]);
  const application = await getCandidateApplicationResumeSnapshot(candidate.id, applicationId);
  if (!application) notFound();
  const thread = await getApplicationMessagesForCandidate({ candidateAccountId: candidate.id, applicationId });
  if (!thread) notFound();
  const messageOutcome = Array.isArray(query.message) ? query.message[0] : query.message;
  const withdrawalOutcome = Array.isArray(query.withdrawal) ? query.withdrawal[0] : query.withdrawal;
  const withdrawalMessage = withdrawalOutcome === "success" ? { role: "status" as const, text: "انصراف شما با موفقیت ثبت شد.", className: "border-success/30 bg-success/5 text-success" }
    : withdrawalOutcome === "already" ? { role: "status" as const, text: "این درخواست قبلاً انصراف داده شده است.", className: "border-ui-border bg-surface-elevated text-text-secondary" }
    : withdrawalOutcome === "not-allowed" ? { role: "alert" as const, text: "در وضعیت فعلی امکان انصراف از این درخواست وجود ندارد.", className: "border-warning/30 bg-warning/5 text-warning" }
    : withdrawalOutcome === "stale" ? { role: "alert" as const, text: "وضعیت درخواست هم‌زمان تغییر کرده است؛ صفحه را دوباره بررسی کنید.", className: "border-warning/30 bg-warning/5 text-warning" }
    : withdrawalOutcome === "error" ? { role: "alert" as const, text: "ثبت انصراف انجام نشد؛ دوباره تلاش کنید.", className: "border-danger/30 bg-danger/5 text-danger" }
    : null;
  const withdrawalEnabled = isCandidateApplicationWithdrawalEnabled();
  const identity = getCandidateApplicationPublicIdentity(application);
  const statusHistory = presentCandidateStatusHistory(application.statusHistory, withdrawalEnabled);

  return <CandidateShell current="applications"><div className="mx-auto min-w-0 max-w-4xl">
    <Link href="/candidate/applications" className={buttonClassNames({ variant: "secondary", size: "small", className: "min-h-11 w-full sm:w-auto" })}>بازگشت به درخواست‌ها</Link>
    <header className="mt-6 min-w-0"><p className="text-meta break-words" dir="auto">{identity.companyName}</p><h1 className="text-page-title mt-2 break-words" dir="auto">رزومه ارسال‌شده برای {identity.jobTitle}</h1><div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center"><p className="text-helper">درخواست ثبت‌شده در {dateFormatter.format(application.applicationCreatedAt)}</p><span className="rounded-full bg-surface-elevated px-3 py-1 text-sm font-semibold">{getCandidateVisibleStatusLabel(application.applicationStatus, withdrawalEnabled)}</span></div></header>
    {withdrawalMessage ? <p role={withdrawalMessage.role} className={`mt-5 rounded-md border p-3 text-sm font-semibold ${withdrawalMessage.className}`}>{withdrawalMessage.text}</p> : null}
    {withdrawalEnabled && canWithdrawApplication(application.applicationStatus) ? <Card className="mt-6 border-warning/30 bg-warning/5 shadow-none"><details><summary className="cursor-pointer font-bold text-warning">انصراف از این درخواست</summary><p className="text-secondary mt-3">با ثبت انصراف، درخواست از فرایند جذب خارج می‌شود و امکان بازگرداندن آن از این بخش وجود ندارد. رزومه و تاریخچه درخواست برای سوابق حفظ می‌شوند.</p><form action={withdrawApplication} className="mt-4 grid gap-4"><input type="hidden" name="applicationId" value={application.applicationId} /><label className="flex cursor-pointer items-start gap-3 text-sm font-medium"><input type="checkbox" name="confirmed" value="true" required className="mt-1 size-4 accent-danger" />از تصمیم خود مطمئن هستم و می‌دانم درخواست مجدد برای همین آگهی مجاز نیست.</label><button type="submit" className={buttonClassNames({ variant: "destructive", className: "w-full sm:w-fit" })}>ثبت انصراف قطعی</button></form></details></Card> : null}
    <Card className="mt-6 overflow-hidden shadow-none">
      <h2 className="text-section-title">تاریخچه وضعیت</h2>
      <p className="text-secondary mt-2">رویدادهای ثبت‌شده برای این درخواست، از قدیمی‌ترین به جدیدترین نمایش داده می‌شوند.</p>
      <ol className="mt-5 grid gap-5 border-s-2 border-ui-border ps-5" aria-label="تاریخچه وضعیت درخواست">
        <li className="relative min-w-0"><span aria-hidden="true" className="absolute -start-[1.7rem] top-1.5 size-3 rounded-full bg-action ring-4 ring-surface" /><p className="font-semibold">درخواست ارسال شد</p><time className="text-helper mt-1 block" dateTime={application.applicationCreatedAt.toISOString()}>{historyFormatter.format(application.applicationCreatedAt)}</time></li>
        {statusHistory.map((item) => <li key={item.id} className="relative min-w-0"><span aria-hidden="true" className={`absolute -start-[1.7rem] top-1.5 size-3 rounded-full ring-4 ring-surface ${item.changedBy === "candidate" ? "bg-warning" : "bg-accent"}`} /><p className="break-words font-semibold">{item.actorLabel}</p><p className="text-secondary mt-1 break-words">از «{item.fromLabel}» به «{item.toLabel}»</p><time className="text-helper mt-1 block" dateTime={item.changedAt.toISOString()}>{historyFormatter.format(item.changedAt)}</time></li>)}
      </ol>
      {statusHistory.length === 0 ? <p className="text-secondary mt-4">پس از ارسال درخواست، هنوز تغییر وضعیت دیگری ثبت نشده است.</p> : null}
    </Card>
    {!application.snapshotAvailable ? <Card className="mt-8 border-warning/30 bg-warning/5"><h2 className="text-card-title">رزومه تاریخی قابل اتکا در دسترس نیست</h2><p className="text-secondary mt-2">این درخواست پیش از فعال‌شدن ثبت رزومه‌های ثابت ایجاد شده است. رزومه فعلی شما به‌عنوان نسخه تاریخی این درخواست نمایش داده نمی‌شود.</p></Card> : <div className="mt-8 grid gap-5">
      <Card className="min-w-0 overflow-hidden"><h2 className="text-card-title break-words" dir="auto">{application.firstName} {application.lastName}</h2><p className="text-secondary mt-2 break-words" dir="auto">{application.professionalTitle} · {application.city}</p><p className="mt-5 whitespace-pre-wrap break-words leading-8">{application.professionalSummary}</p>{application.skills?.length ? <div className="mt-5 flex flex-wrap gap-2">{application.skills.map((skill) => <span key={skill} className="max-w-full break-words rounded-full bg-surface-muted px-3 py-1 text-sm" dir="auto">{skill}</span>)}</div> : null}</Card>
      <Card><h2 className="text-card-title">سوابق شغلی</h2><div className="mt-4 grid gap-4">{application.experiences.map((item, index) => <article key={`${item.companyName}-${index}`}><h3 className="font-semibold">{item.jobTitle} در {item.companyName}</h3><p className="text-helper mt-1">{item.startDate} تا {item.isCurrent ? "اکنون" : item.endDate}</p>{item.description ? <p className="text-secondary mt-2 whitespace-pre-wrap">{item.description}</p> : null}</article>)}</div></Card>
      <Card><h2 className="text-card-title">تحصیلات</h2><div className="mt-4 grid gap-4">{application.educations.map((item, index) => <article key={`${item.institutionName}-${index}`}><h3 className="font-semibold">{item.fieldOfStudy}، {item.degree}</h3><p className="text-secondary mt-1">{item.institutionName}</p><p className="text-helper mt-1">{item.startDate} تا {item.isCurrent ? "اکنون" : item.endDate}</p></article>)}</div></Card>
      {application.languages.length ? <Card><h2 className="text-card-title">زبان‌ها</h2><ul className="mt-4 grid gap-2">{application.languages.map((item) => <li key={item.name}>{item.name} — {item.proficiency}</li>)}</ul></Card> : null}
      {application.credentials.length ? <Card><h2 className="text-card-title">گواهی‌ها و دوره‌ها در زمان ارسال</h2><div className="mt-4 grid gap-4">{application.credentials.map((item) => <article key={item.id}><p className="text-meta">{credentialRecordTypeLabels[item.recordType]}</p><h3 className="font-semibold">{item.title}</h3><p className="text-secondary mt-1">{item.issuer}</p></article>)}</div></Card> : null}
      <p className="text-helper">این نسخه هنگام ارسال درخواست ثبت شده و با ویرایش رزومه فعلی تغییر نمی‌کند.</p>
    </div>}
    <ApplicationMessageThread applicationId={applicationId} viewerRole="candidate" messages={thread.messages} outcome={messageOutcome} sendAction={sendCandidateApplicationMessage} markReadAction={markCandidateMessagesRead} canSend={canSendApplicationMessage({ applicationStatus: thread.status, jobStatus: thread.jobStatus, senderRole: "candidate", kind: "recruitment_message", hasEmployerMessage: thread.messages.some((message) => message.senderRole === "employer") })} />
  </div></CandidateShell>;
}
