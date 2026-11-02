import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { DataRequestForm } from "@/components/candidate/data-request-form";
import { Badge, Card } from "@/components/ui";
import { submitCandidateDataRequest } from "@/candidate-data-requests/actions";
import { isCandidateDataRequestsEnabled } from "@/candidate-data-requests/feature";
import { listCandidateDataRequests } from "@/candidate-data-requests/repository";
import { candidateDataRequestStatusLabels, candidateDataRequestTypeLabels, isActiveCandidateDataRequestStatus } from "@/candidate-data-requests/policy";

interface PageProps { searchParams: Promise<{ result?: string | string[] }>; }
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short" });

export default async function CandidatePrivacyPage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const enabled = isCandidateDataRequestsEnabled();
  const [query, requests] = await Promise.all([
    searchParams,
    enabled ? listCandidateDataRequests(candidate.id) : Promise.resolve([]),
  ]);
  const result = Array.isArray(query.result) ? query.result[0] : query.result;
  const activeTypes = new Set(requests.filter((request) => isActiveCandidateDataRequestStatus(request.status)).map((request) => request.requestType));
  return <CandidateShell current="privacy"><div className="mx-auto max-w-4xl">
    <header><p className="text-meta">تنظیمات حساب</p><h1 className="text-page-title mt-2">حریم خصوصی و درخواست‌های داده</h1><p className="text-secondary mt-3">درخواست دریافت داده یا بررسی حذف حساب خود را ثبت و وضعیت آن را پیگیری کنید.</p></header>
    {!enabled ? <p role="note" className="mt-6 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">این بخش هنوز فعال نشده است. پس از اعمال migration توسط مالک محصول در دسترس خواهد بود.</p> : null}
    {result === "created" ? <p role="status" className="mt-6 rounded-md border border-success/30 bg-success/5 p-3 text-sm font-semibold text-success">درخواست با موفقیت ثبت شد.</p> : null}
    {result === "already-active" ? <p role="status" className="mt-6 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">یک درخواست فعال از همین نوع دارید.</p> : null}
    {result === "error" ? <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.</p> : null}
    {result === "unavailable" ? <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">درخواست معتبر نبود یا این قابلیت هنوز فعال نشده است.</p> : null}
    <section className="mt-7 grid gap-5 md:grid-cols-2" aria-label="ثبت درخواست جدید">
      <Card className="shadow-none"><h2 className="text-card-title">نسخه داده‌های شخصی</h2><p className="text-secondary mt-2">این گزینه فقط یک درخواست قابل پیگیری ثبت می‌کند. هیچ فایل یا اطلاعات حساسی به‌صورت خودکار دانلود نمی‌شود.</p><div className="mt-5"><DataRequestForm requestType="personal_data_export" label="ثبت درخواست دریافت داده" disabled={!enabled || activeTypes.has("personal_data_export")} disabledLabel={!enabled ? "در حال حاضر غیرفعال" : undefined} action={submitCandidateDataRequest} /></div></Card>
      <Card className="border-danger/20 shadow-none"><h2 className="text-card-title">درخواست حذف حساب</h2><p className="text-secondary mt-2">ثبت این درخواست حساب یا سوابق شما را فوراً حذف نمی‌کند. درخواست باید در فرایند عملیاتی جداگانه بررسی شود.</p><div className="mt-5"><DataRequestForm requestType="account_deletion" label="ثبت درخواست حذف حساب" destructive disabled={!enabled || activeTypes.has("account_deletion")} disabledLabel={!enabled ? "در حال حاضر غیرفعال" : undefined} action={submitCandidateDataRequest} /></div></Card>
    </section>
    <section className="mt-8" aria-labelledby="request-history-heading"><h2 id="request-history-heading" className="text-section-title">تاریخچه درخواست‌ها</h2>{requests.length ? <div className="mt-4 grid gap-3">{requests.map((request) => <Card key={request.id} className="shadow-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{candidateDataRequestTypeLabels[request.requestType]}</h3><time className="text-helper mt-2 block" dateTime={request.createdAt.toISOString()}>ثبت‌شده در {dateFormatter.format(request.createdAt)}</time></div><Badge>{candidateDataRequestStatusLabels[request.status]}</Badge></div></Card>)}</div> : <Card className="mt-4 text-center shadow-none"><p className="text-secondary">هنوز درخواستی ثبت نشده است.</p></Card>}</section>
    <p className="text-helper mt-6">زمان‌بندی انجام، نحوه تحویل داده و سیاست حذف پس از تصویب رویه عملیاتی اعلام خواهد شد؛ این صفحه ادعای تعهد حقوقی یا دوره نگهداری مشخصی ندارد.</p>
  </div></CandidateShell>;
}
