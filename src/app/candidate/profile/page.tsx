import Link from "next/link";
import { requireCandidate } from "@/candidate-auth/session";
import { getCandidateBasicProfile } from "@/candidate-profile/repository";
import { CandidateProfileForm } from "@/components/candidate/candidate-profile-form";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Card, buttonClassNames } from "@/components/ui";

function maskedContact(email: string | null, mobile: string | null) {
  if (email) {
    const [local, domain] = email.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (mobile) return `${mobile.slice(0, 4)}***${mobile.slice(-3)}`;
  return "—";
}

export default async function CandidateProfilePage() {
  const candidate = await requireCandidate();
  const profile = await getCandidateBasicProfile(candidate.id);
  return <CandidateShell current="profile"><div className="mx-auto max-w-4xl">
    <div className="mb-7"><p className="text-meta">حساب کارجو</p><h1 className="text-page-title mt-2">پروفایل من</h1><p className="text-secondary mt-3">اطلاعات پایه و حرفه‌ای قابل‌نمایش در رزومه خود را مدیریت کنید.</p></div>
    <Card className="mb-6 shadow-none"><h2 className="text-card-title">شناسه ورود تأییدشده</h2><p dir="ltr" className="text-secondary mt-2 text-left">{maskedContact(profile?.email ?? null, profile?.mobile ?? null)}</p><p className="text-helper mt-2">تغییر ایمیل یا شماره همراه فقط از مسیر تأیید هویت اختصاصی امکان‌پذیر خواهد بود.</p></Card>
    {profile?.resumeId ? <CandidateProfileForm initialValues={{ firstName: profile.firstName!, lastName: profile.lastName!, city: profile.city!, professionalTitle: profile.professionalTitle!, professionalSummary: profile.professionalSummary!, linkedinUrl: profile.linkedinUrl ?? "", portfolioUrl: profile.portfolioUrl ?? "" }} /> : <Card className="text-center shadow-none"><h2 className="text-card-title">برای تکمیل پروفایل، رزومه را ایجاد کنید</h2><p className="text-secondary mt-2">اطلاعات پایه یک‌بار در رزومه ذخیره می‌شود و در پروفایل نیز قابل ویرایش خواهد بود.</p><Link href="/candidate/resume" className={buttonClassNames({ className: "mt-5" })}>ساخت رزومه</Link></Card>}
  </div></CandidateShell>;
}
