import type { Metadata } from "next";
import Link from "next/link";
import { applicationStatusLabels, getEnabledApplicationStatuses, isCandidateApplicationWithdrawalEnabled } from "@/applications/status-policy";
import { getCandidateVisibleStatusLabel } from "@/applications/candidate-history-presentation";
import { requireCandidate } from "@/candidate-auth/session";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { CandidateProfilePhotoAvatar } from "@/components/candidate/candidate-profile-photo";
import { isCandidateProfilePhotoEnabled } from "@/candidate-profile-photo/feature";
import { getCandidateProfilePhoto } from "@/candidate-profile-photo/repository";
import { JobOpportunityCard } from "@/components/jobs/job-opportunity-card";
import { Badge, Card, buttonClassNames } from "@/components/ui";
import {
  buildCandidateDashboardProfile,
  CANDIDATE_DASHBOARD_RECOMMENDATION_LIMIT,
  recommendationPreview,
} from "@/dashboard/candidate-policy";
import {
  getCandidateDashboardApplicationMetrics,
  getCandidateDashboardRecentApplications,
} from "@/dashboard/candidate-queries";
import {
  getCandidateRecommendationProfile,
  getRecommendedJobsForProfile,
} from "@/recommendations/queries";
import { buildRecommendationReasonLabels } from "@/recommendations/policy";

export const metadata: Metadata = { title: "پنل کارجو" };

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });

export default async function CandidateDashboardPage() {
  const candidate = await requireCandidate();
  const profilePhotoEnabled = isCandidateProfilePhotoEnabled();
  const profilePhotoPromise = profilePhotoEnabled
    ? getCandidateProfilePhoto(candidate.id)
    : Promise.resolve(null);
  const profile = await getCandidateRecommendationProfile(candidate.id);
  const summary = buildCandidateDashboardProfile(profile);
  const [applicationMetrics, recentApplications, recommendationRows, profilePhoto] = await Promise.all([
    getCandidateDashboardApplicationMetrics(candidate.id),
    getCandidateDashboardRecentApplications(candidate.id),
    profile && summary.recommendationsUsable
      ? getRecommendedJobsForProfile(
        candidate.id,
        profile,
        new Date(),
        CANDIDATE_DASHBOARD_RECOMMENDATION_LIMIT,
      ).catch((error: unknown) => {
        console.error(JSON.stringify({ event: "candidate_dashboard_recommendations_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
        return [];
      })
      : Promise.resolve([]),
    profilePhotoPromise,
  ]);
  const recommendations = recommendationPreview(recommendationRows);
  const withdrawalEnabled = isCandidateApplicationWithdrawalEnabled();

  return <CandidateShell current="home"><div className="mx-auto max-w-6xl">
    <header className="flex min-w-0 items-center gap-4">{profilePhoto ? <CandidateProfilePhotoAvatar version={profilePhoto.updatedAt.toISOString()} /> : null}<div className="min-w-0"><p className="text-meta">پنل کارجو</p><h1 className="text-page-title mt-2 break-words">{summary.greetingName ? `${summary.greetingName}، خوش آمدید` : "خوش آمدید"}</h1><p className="text-secondary mt-3">وضعیت رزومه، درخواست‌ها و پیشنهادهای شغلی خود را یک‌جا ببینید.</p></div></header>

    <section aria-label="آمادگی پروفایل" className="mt-8 grid gap-4 md:grid-cols-2">
      <Card className="shadow-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-card-title">آمادگی رزومه</h2><p className="text-secondary mt-2">{summary.resumeComplete ? "رزومه برای ارسال درخواست آماده است." : summary.resumeExists ? "رزومه هنوز شرایط لازم برای ارسال درخواست را ندارد." : "هنوز رزومه‌ای نساخته‌اید."}</p></div><Badge variant={summary.resumeComplete ? "success" : "warning"}>{summary.resumeComplete ? "آماده" : "نیازمند تکمیل"}</Badge></div>{summary.professionalTitle ? <p className="text-label mt-4">{summary.professionalTitle}</p> : null}<p className="text-helper mt-2">{summary.skillCount.toLocaleString("fa-IR")} مهارت ثبت‌شده</p><Link href="/candidate/resume" className={buttonClassNames({ variant: summary.resumeComplete ? "secondary" : "primary", className: "mt-5" })}>{summary.resumeComplete ? "ویرایش رزومه" : "تکمیل رزومه"}</Link></Card>

      <Card className="shadow-none"><h2 className="text-card-title">ترجیحات شغلی</h2>{summary.hasPreferences ? <><p className="text-secondary mt-2">خلاصه انتخاب‌های فعلی شما</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-helper">محل کاری</dt><dd className="mt-1 font-semibold">{summary.preferredLocationCount.toLocaleString("fa-IR")} مورد</dd></div><div><dt className="text-helper">نحوه حضور</dt><dd className="mt-1 font-semibold">{summary.preferredWorkplaceCount.toLocaleString("fa-IR")} مورد</dd></div><div><dt className="text-helper">نوع همکاری</dt><dd className="mt-1 font-semibold">{summary.preferredEmploymentCount.toLocaleString("fa-IR")} مورد</dd></div><div><dt className="text-helper">سطح شغلی</dt><dd className="mt-1 font-semibold">{summary.preferredSeniorityCount.toLocaleString("fa-IR")} مورد</dd></div></dl></> : <p className="text-secondary mt-2">با افزودن ترجیحات، پیشنهادهای شغلی دقیق‌تری دریافت می‌کنید.</p>}<Link href="/candidate/preferences" className={buttonClassNames({ variant: "secondary", className: "mt-5" })}>ویرایش ترجیحات شغلی</Link></Card>
    </section>

    <section aria-labelledby="application-metrics-heading" className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="application-metrics-heading" className="text-section-title">وضعیت درخواست‌ها</h2><p className="text-secondary mt-2">نمای کلی از آخرین وضعیت درخواست‌های شما</p></div><Link href="/candidate/applications" className="text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">مشاهده همه درخواست‌ها</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7"><Card className="shadow-none"><p className="text-helper">همه</p><p className="mt-2 text-2xl font-bold">{applicationMetrics.total.toLocaleString("fa-IR")}</p></Card>{getEnabledApplicationStatuses().map((status) => <Card key={status} className="shadow-none"><p className="text-helper">{applicationStatusLabels[status]}</p><p className="mt-2 text-2xl font-bold">{applicationMetrics[status].toLocaleString("fa-IR")}</p></Card>)}</div></section>

    <section aria-labelledby="recent-applications-heading" className="mt-8"><h2 id="recent-applications-heading" className="text-section-title">درخواست‌های اخیر</h2>{recentApplications.length ? <div className="mt-4 grid gap-3">{recentApplications.map((application) => <Card key={application.id} className="min-w-0 overflow-hidden shadow-none"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><h3 className="break-words font-semibold" dir="auto"><Link href={`/candidate/applications/${application.id}`} className="outline-none hover:text-action focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">{application.jobTitle}</Link></h3><p className="text-secondary mt-1 break-words text-sm" dir="auto">{application.companyName}</p><time className="text-meta mt-2 block" dateTime={application.createdAt.toISOString()}>ارسال‌شده در {dateFormatter.format(application.createdAt)}</time></div><Badge>{getCandidateVisibleStatusLabel(application.status, withdrawalEnabled)}</Badge></div></Card>)}</div> : <Card className="mt-4 text-center shadow-none"><h3 className="text-card-title">هنوز برای فرصت شغلی‌ای درخواست ارسال نکرده‌اید</h3><p className="text-secondary mt-2">فرصت‌های فعال را ببینید و رزومه خود را ارسال کنید.</p><div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><Link href="/jobs" className={buttonClassNames()}>مشاهده همه فرصت‌های شغلی</Link>{summary.recommendationsUsable ? <Link href="/candidate/recommended-jobs" className={buttonClassNames({ variant: "secondary" })}>آگهی‌های پیشنهادی</Link> : null}</div></Card>}</section>

    <section aria-labelledby="recommended-preview-heading" className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="recommended-preview-heading" className="text-section-title">فرصت‌های شغلی پیشنهادی برای شما</h2><p className="text-secondary mt-2">متناسب با مهارت‌ها و ترجیحات فعلی شما</p></div>{recommendations.length ? <Link href="/candidate/recommended-jobs" className="text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">مشاهده همه آگهی‌های پیشنهادی</Link> : null}</div>{recommendations.length ? <div className="mt-4 grid gap-3 lg:grid-cols-3">{recommendations.map((job) => <JobOpportunityCard key={job.id} job={job} reasons={buildRecommendationReasonLabels(job).slice(0, 2)} variant="compact" headingLevel="h3" />)}</div> : <Card className="mt-4 text-center shadow-none"><h3 className="text-card-title">{!summary.resumeExists ? "ابتدا رزومه خود را تکمیل کنید" : !summary.recommendationsUsable ? "مهارت‌های رزومه را تکمیل کنید" : "در حال حاضر پیشنهاد مناسبی پیدا نشد"}</h3><p className="text-secondary mt-2">{summary.recommendationsUsable ? "ترجیحات خود را به‌روز کنید یا همه فرصت‌های شغلی فعال را ببینید." : "مهارت‌ها، پایه اصلی پیشنهاد فرصت‌های مرتبط هستند."}</p><div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">{!summary.recommendationsUsable ? <Link href="/candidate/resume" className={buttonClassNames()}>تکمیل رزومه</Link> : <Link href="/candidate/preferences" className={buttonClassNames({ variant: "secondary" })}>ویرایش ترجیحات</Link>}<Link href="/jobs" className={buttonClassNames({ variant: "secondary" })}>مشاهده همه فرصت‌های شغلی</Link></div></Card>}</section>

    <section aria-labelledby="quick-actions-heading" className="mt-8"><h2 id="quick-actions-heading" className="text-section-title">دسترسی سریع</h2><div className="mt-4 flex flex-wrap gap-2"><Link href="/candidate/resume" className={buttonClassNames({ variant: "secondary" })}>ویرایش رزومه</Link><Link href="/candidate/preferences" className={buttonClassNames({ variant: "secondary" })}>ترجیحات شغلی</Link><Link href="/candidate/recommended-jobs" className={buttonClassNames({ variant: "secondary" })}>آگهی‌های پیشنهادی</Link><Link href="/candidate/applications" className={buttonClassNames({ variant: "secondary" })}>درخواست‌های من</Link><Link href="/jobs" className={buttonClassNames({ variant: "secondary" })}>مشاهده همه فرصت‌های شغلی</Link></div></section>
  </div></CandidateShell>;
}
