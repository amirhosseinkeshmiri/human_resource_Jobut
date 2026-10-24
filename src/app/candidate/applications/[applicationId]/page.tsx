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

export const metadata: Metadata = { title: "رزومه ارسال‌شده" };
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

export default async function CandidateApplicationSnapshotPage({ params, searchParams }: { params: Promise<{ applicationId: string }>; searchParams: Promise<{ message?: string | string[] }> }) {
  const candidate = await requireCandidate();
  const [{ applicationId }, query] = await Promise.all([params, searchParams]);
  const application = await getCandidateApplicationResumeSnapshot(candidate.id, applicationId);
  if (!application) notFound();
  const thread = await getApplicationMessagesForCandidate({ candidateAccountId: candidate.id, applicationId });
  if (!thread) notFound();
  const messageOutcome = Array.isArray(query.message) ? query.message[0] : query.message;

  return <CandidateShell current="applications"><div className="mx-auto max-w-4xl">
    <Link href="/candidate/applications" className={buttonClassNames({ variant: "secondary", size: "small" })}>بازگشت به درخواست‌ها</Link>
    <header className="mt-6"><p className="text-meta">{application.companyName}</p><h1 className="text-page-title mt-2">رزومه ارسال‌شده برای {application.jobTitle}</h1><p className="text-helper mt-3">درخواست ثبت‌شده در {dateFormatter.format(application.applicationCreatedAt)}</p></header>
    {!application.snapshotAvailable ? <Card className="mt-8 border-warning/30 bg-warning/5"><h2 className="text-card-title">رزومه تاریخی قابل اتکا در دسترس نیست</h2><p className="text-secondary mt-2">این درخواست پیش از فعال‌شدن ثبت رزومه‌های ثابت ایجاد شده است. رزومه فعلی شما به‌عنوان نسخه تاریخی این درخواست نمایش داده نمی‌شود.</p></Card> : <div className="mt-8 grid gap-5">
      <Card><h2 className="text-card-title">{application.firstName} {application.lastName}</h2><p className="text-secondary mt-2">{application.professionalTitle} · {application.city}</p><p className="mt-5 whitespace-pre-wrap leading-8">{application.professionalSummary}</p>{application.skills?.length ? <div className="mt-5 flex flex-wrap gap-2">{application.skills.map((skill) => <span key={skill} className="rounded-full bg-surface-muted px-3 py-1 text-sm">{skill}</span>)}</div> : null}</Card>
      <Card><h2 className="text-card-title">سوابق شغلی</h2><div className="mt-4 grid gap-4">{application.experiences.map((item, index) => <article key={`${item.companyName}-${index}`}><h3 className="font-semibold">{item.jobTitle} در {item.companyName}</h3><p className="text-helper mt-1">{item.startDate} تا {item.isCurrent ? "اکنون" : item.endDate}</p>{item.description ? <p className="text-secondary mt-2 whitespace-pre-wrap">{item.description}</p> : null}</article>)}</div></Card>
      <Card><h2 className="text-card-title">تحصیلات</h2><div className="mt-4 grid gap-4">{application.educations.map((item, index) => <article key={`${item.institutionName}-${index}`}><h3 className="font-semibold">{item.fieldOfStudy}، {item.degree}</h3><p className="text-secondary mt-1">{item.institutionName}</p><p className="text-helper mt-1">{item.startDate} تا {item.isCurrent ? "اکنون" : item.endDate}</p></article>)}</div></Card>
      {application.languages.length ? <Card><h2 className="text-card-title">زبان‌ها</h2><ul className="mt-4 grid gap-2">{application.languages.map((item) => <li key={item.name}>{item.name} — {item.proficiency}</li>)}</ul></Card> : null}
      <p className="text-helper">این نسخه هنگام ارسال درخواست ثبت شده و با ویرایش رزومه فعلی تغییر نمی‌کند.</p>
    </div>}
    <ApplicationMessageThread applicationId={applicationId} viewerRole="candidate" messages={thread.messages} outcome={messageOutcome} sendAction={sendCandidateApplicationMessage} markReadAction={markCandidateMessagesRead} canSend={canSendApplicationMessage({ applicationStatus: thread.status, jobStatus: thread.jobStatus, senderRole: "candidate", kind: "recruitment_message", hasEmployerMessage: thread.messages.some((message) => message.senderRole === "employer") })} />
  </div></CandidateShell>;
}
