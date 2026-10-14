import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { applyToJob } from "@/applications/actions";
import { getApplicationEligibility } from "@/applications/policy";
import { getCandidateApplyState } from "@/applications/queries";
import { getCurrentCandidate } from "@/candidate-auth/session";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { PublicFooter } from "@/components/landing/public-footer";
import { PublicHeader } from "@/components/landing/public-header";
import { Badge, Button, Card, Container, buttonClassNames } from "@/components/ui";
import { sanitizeJobDescription } from "@/jobs/description";
import { formatJobSalary } from "@/jobs/public-policy";
import { getPublicJobById } from "@/jobs/public-queries";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";

export const dynamic = "force-dynamic";

interface PublicJobPageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: PublicJobPageProps): Promise<Metadata> {
  const { jobId } = await params;
  const job = await getPublicJobById(jobId);
  if (!job) return { title: "آگهی پیدا نشد" };

  return {
    title: `${job.title} در ${job.companyName}`,
    description: `آگهی ${job.title} در ${job.companyName}`,
  };
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

export default async function PublicJobPage({ params }: PublicJobPageProps) {
  const { jobId } = await params;
  const [job, candidate] = await Promise.all([getPublicJobById(jobId), getCurrentCandidate()]);
  if (!job) notFound();
  const candidateState = candidate ? await getCandidateApplyState(candidate.id, job.id) : null;
  const applicationEligibility = getApplicationEligibility({
    authenticated: Boolean(candidate),
    resumeComplete: candidateState?.resumeComplete ?? false,
    alreadyApplied: candidateState?.alreadyApplied ?? false,
    job,
  });

  return (
    <>
      <PublicHeader />
      <main>
        <Container className="py-8 sm:py-12">
          <Link href="/jobs" className="text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">بازگشت به آگهی‌ها</Link>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <article className="grid gap-5">
              <Card className="shadow-none">
                <div className="flex items-start gap-4">
                  <CompanyLogo companyName={job.companyName} logoUrl={job.companyLogoUrl} size="large" />
                  <div className="min-w-0">
                    <h1 className="text-page-title break-words">{job.title}</h1>
                    <p className="mt-2 font-semibold text-text-secondary">{job.companyName}</p>
                    <p className="text-meta mt-1">{job.industryName}</p>
                  </div>
                </div>
              </Card>

              <Card className="shadow-none">
                <h2 className="text-section-title">توضیحات شغل</h2>
                <div
                  className="text-body mt-5 grid gap-3 text-text-secondary [&_ol]:list-decimal [&_ol]:pe-6 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pe-6"
                  dangerouslySetInnerHTML={{ __html: sanitizeJobDescription(job.description) }}
                />
              </Card>
            </article>

            <aside aria-label="خلاصه آگهی" className="grid gap-4 lg:sticky lg:top-28">
              <Card className="shadow-none">
                <h2 className="text-card-title">مشخصات موقعیت</h2>
                <dl className="mt-5 grid gap-4 text-sm">
                  <div><dt className="text-meta">شهر</dt><dd className="mt-1 font-semibold">{job.location}</dd></div>
                  <div><dt className="text-meta">نوع حضور</dt><dd className="mt-1 font-semibold">{job.workplaceType ? workplaceTypeLabels[job.workplaceType] : "—"}</dd></div>
                  <div><dt className="text-meta">نوع همکاری</dt><dd className="mt-1 font-semibold">{job.employmentType ? employmentTypeLabels[job.employmentType] : "—"}</dd></div>
                  <div><dt className="text-meta">سطح ارشدیت</dt><dd className="mt-1 font-semibold">{job.seniorityLevel ? seniorityLevelLabels[job.seniorityLevel] : "—"}</dd></div>
                  <div><dt className="text-meta">حقوق</dt><dd className="mt-1 font-semibold">{formatJobSalary(job)}</dd></div>
                </dl>
              </Card>

              <Card className="shadow-none">
                <h2 className="text-card-title">مهارت‌های کلیدی</h2>
                <div className="mt-4 flex flex-wrap gap-2">{job.requiredSkills?.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div>
              </Card>

              <Card className="shadow-none">
                <h2 className="text-card-title">زمان‌بندی آگهی</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div><dt className="text-meta">تاریخ انتشار</dt><dd className="mt-1">{job.publishedAt ? dateFormatter.format(job.publishedAt) : "—"}</dd></div>
                  <div><dt className="text-meta">اعتبار تا</dt><dd className="mt-1">{job.expiresAt ? dateFormatter.format(job.expiresAt) : "—"}</dd></div>
                </dl>
              </Card>

              <Card className="shadow-none">
                <h2 className="text-card-title">ارسال درخواست</h2>
                {applicationEligibility === "login-required" ? <><p className="text-secondary mt-2">برای ارسال رزومه وارد حساب کارجو شوید.</p><Link href="/login/candidate" className={buttonClassNames({ className: "mt-4 w-full" })}>ورود به حساب کارجو</Link></> : null}
                {applicationEligibility === "resume-required" ? <><p className="text-secondary mt-2">برای ارسال درخواست ابتدا رزومه خود را تکمیل کنید.</p><Link href="/candidate/resume" className={buttonClassNames({ className: "mt-4 w-full" })}>تکمیل رزومه</Link></> : null}
                {applicationEligibility === "already-applied" ? <><p className="mt-2 font-semibold text-success">درخواست شما ارسال شده است.</p><Link href="/candidate/applications" className={buttonClassNames({ variant: "secondary", className: "mt-4 w-full" })}>مشاهده درخواست‌های من</Link></> : null}
                {applicationEligibility === "eligible" ? <><p className="text-secondary mt-2">رزومه فعلی شما در شبکه استخدامی متخصصین آکادمیک برای این فرصت ارسال می‌شود.</p><form action={applyToJob} className="mt-4"><input type="hidden" name="jobPostId" value={job.id} /><Button type="submit" className="w-full">ارسال رزومه</Button></form></> : null}
                {applicationEligibility === "job-unavailable" ? <p className="text-secondary mt-2">این آگهی دیگر فعال نیست.</p> : null}
              </Card>

              <Link href="/jobs" className={buttonClassNames({ variant: "secondary", className: "w-full" })}>مشاهده سایر آگهی‌ها</Link>
            </aside>
          </div>
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
