import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Button, Card } from "@/components/ui";
import { acceptCurrentCandidateLegalDocuments } from "@/legal/actions";
import { CURRENT_LEGAL_DOCUMENTS, LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE } from "@/legal/documents";
import { isCandidateLegalAcceptanceFeatureEnabled } from "@/legal/feature";
import { findCurrentCandidateLegalAcceptance } from "@/legal/repository";

interface PageProps { searchParams: Promise<{ error?: string | string[]; required?: string | string[] }>; }

export default async function CandidateLegalAcceptancePage({ searchParams }: PageProps) {
  const candidate = await requireCandidate();
  const enabled = isCandidateLegalAcceptanceFeatureEnabled();
  const ready = enabled && LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE;
  const [query, acceptance] = await Promise.all([
    searchParams,
    ready ? findCurrentCandidateLegalAcceptance(candidate.id, CURRENT_LEGAL_DOCUMENTS) : Promise.resolve(null),
  ]);
  const error = (Array.isArray(query.error) ? query.error[0] : query.error) === "required";
  return <CandidateShell current="legal"><div className="mx-auto max-w-3xl"><Card className="shadow-none">
    <p className="text-meta">اسناد حقوقی حساب کارجو</p><h1 className="text-page-title mt-2">بررسی و پذیرش شرایط</h1>
    {acceptance ? <p role="status" className="mt-5 rounded-md border border-success/30 bg-success/5 p-3 text-sm font-semibold text-success">نسخه‌های جاری قبلاً پذیرفته شده‌اند.</p> : null}
    {!ready ? <p role="note" className="mt-5 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">پذیرش هنوز فعال نیست؛ متن حقوقی مصوب باید ارائه و migration توسط مالک محصول اعمال شود.</p> : null}
    {error ? <p role="alert" className="mt-5 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">برای ادامه باید هر دو سند را جداگانه بررسی و تأیید کنید.</p> : null}
    <form action={acceptCurrentCandidateLegalDocuments} className="mt-7 grid gap-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ui-border p-4"><input type="checkbox" name="termsAccepted" value="yes" className="mt-1 size-4 accent-action" disabled={!ready || Boolean(acceptance)} /><span>شرایط استفاده نسخه <bdi>{CURRENT_LEGAL_DOCUMENTS.termsVersion}</bdi> را مطالعه کرده و می‌پذیرم. <Link href="/terms" target="_blank" className="font-semibold text-action underline">مشاهده سند</Link></span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ui-border p-4"><input type="checkbox" name="privacyAccepted" value="yes" className="mt-1 size-4 accent-action" disabled={!ready || Boolean(acceptance)} /><span>سیاست حریم خصوصی نسخه <bdi>{CURRENT_LEGAL_DOCUMENTS.privacyVersion}</bdi> را مطالعه کرده و می‌پذیرم. <Link href="/privacy" target="_blank" className="font-semibold text-action underline">مشاهده سند</Link></span></label>
      <p className="text-helper">این تأیید فقط برای اسناد لازم استفاده از خدمات است و شامل رضایت بازاریابی نمی‌شود.</p>
      <Button type="submit" disabled={!ready || Boolean(acceptance)}>ثبت پذیرش</Button>
    </form>
  </Card></div></CandidateShell>;
}
