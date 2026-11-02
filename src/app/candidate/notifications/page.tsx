import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Badge, Button, Card, buttonClassNames } from "@/components/ui";
import { applicationStatusLabels } from "@/applications/status-policy";
import { markApplicationNotificationRead } from "@/notifications/actions";
import { parseCandidateNotificationPage } from "@/notifications/application-status-policy";
import { isCandidateApplicationNotificationsEnabled } from "@/notifications/feature";
import { getCandidateApplicationNotifications } from "@/notifications/repository";
import { reconcileCandidateApplicationStatusNotifications } from "@/notifications/service";

interface PageProps { searchParams: Promise<{ page?: string | string[]; result?: string | string[] }>; }
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short" });

export default async function CandidateNotificationsPage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const query = await searchParams;
  const enabled = isCandidateApplicationNotificationsEnabled();
  const page = parseCandidateNotificationPage(query.page);
  const reconciliation = enabled
    ? await reconcileCandidateApplicationStatusNotifications(candidate.id)
    : "disabled" as const;
  const data = enabled
    ? await getCandidateApplicationNotifications(candidate.id, page)
    : { notifications: [], total: 0, unread: 0, page: 1, pageCount: 1 };
  const result = Array.isArray(query.result) ? query.result[0] : query.result;

  return <CandidateShell current="notifications"><div className="mx-auto max-w-4xl">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-meta">پیگیری درخواست‌ها</p><h1 className="text-page-title mt-2">اعلان‌ها</h1><p className="text-secondary mt-3">تغییر وضعیت درخواست‌های شغلی خود را اینجا ببینید.</p></div><Badge variant={data.unread ? "warning" : "neutral"}>{data.unread.toLocaleString("fa-IR")} خوانده‌نشده</Badge></header>
    {!enabled ? <p role="note" className="mt-6 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">مرکز اعلان هنوز فعال نشده است. پس از اعمال migration توسط مالک محصول فعال خواهد شد.</p> : null}
    {reconciliation === "failed" ? <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">بازیابی آخرین اعلان‌ها کامل نشد. بعداً دوباره تلاش کنید.</p> : null}
    {result === "invalid" || result === "not-found" ? <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">اعلان موردنظر معتبر یا متعلق به این حساب نیست.</p> : null}
    {data.notifications.length ? <section className="mt-7 grid gap-3" aria-label="فهرست اعلان‌ها">{data.notifications.map((notification) => <Card key={notification.id} className={`shadow-none ${notification.readAt ? "" : "border-action/30 bg-action/5"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">وضعیت درخواست «{notification.jobTitle}» تغییر کرد</h2>{notification.readAt ? null : <Badge variant="warning">جدید</Badge>}</div><p className="text-secondary mt-2">{notification.companyName} · وضعیت جدید: {applicationStatusLabels[notification.toStatus]}</p><time className="text-helper mt-2 block" dateTime={notification.occurredAt.toISOString()}>{dateFormatter.format(notification.occurredAt)}</time></div><div className="flex shrink-0 flex-col gap-2 sm:items-end"><Link href={`/candidate/applications/${notification.applicationId}`} className={buttonClassNames({ variant: "secondary", size: "small" })}>مشاهده درخواست</Link>{notification.readAt ? null : <form action={markApplicationNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><Button type="submit" variant="ghost" size="small">علامت‌گذاری به‌عنوان خوانده‌شده</Button></form>}</div></div></Card>)}</section> : enabled ? <Card className="mt-7 text-center shadow-none"><h2 className="text-card-title">اعلان جدیدی ندارید</h2><p className="text-secondary mt-2">تغییر وضعیت درخواست‌های شما در این بخش نمایش داده می‌شود.</p></Card> : null}
    {data.pageCount > 1 ? <nav aria-label="صفحه‌بندی اعلان‌ها" className="mt-7 flex items-center justify-between gap-3">{data.page > 1 ? <Link href={`/candidate/notifications?page=${data.page - 1}`} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}<span className="text-helper">صفحه {data.page.toLocaleString("fa-IR")} از {data.pageCount.toLocaleString("fa-IR")}</span>{data.page < data.pageCount ? <Link href={`/candidate/notifications?page=${data.page + 1}`} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : <span />}</nav> : null}
  </div></CandidateShell>;
}
