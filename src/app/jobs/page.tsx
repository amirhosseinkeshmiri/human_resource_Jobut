import type { Metadata } from "next";
import Link from "next/link";
import { PublicJobCard } from "@/components/jobs/public-job-card";
import { PublicFooter } from "@/components/landing/public-footer";
import { PublicHeader } from "@/components/landing/public-header";
import { Button, Card, Container, FormField, Input, Select, buttonClassNames } from "@/components/ui";
import { getPublicJobs } from "@/jobs/public-queries";
import {
  buildPublicJobsHref,
  hasPublicJobFilters,
  parsePublicJobFilters,
  PUBLIC_JOB_LOCATION_MAX_LENGTH,
  PUBLIC_JOB_QUERY_MAX_LENGTH,
  PUBLIC_JOB_SALARY_MAX,
  PUBLIC_JOBS_CLEAR_URL,
  type PublicJobSearchParams,
} from "@/jobs/public-search";
import {
  employmentTypeLabels,
  employmentTypes,
  seniorityLevelLabels,
  seniorityLevels,
  workplaceTypeLabels,
  workplaceTypes,
} from "@/jobs/validation";
import { PUBLIC_JOBS_LABEL } from "@/jobs/public-copy";
import { getCurrentCandidate } from "@/candidate-auth/session";
import { isCandidateSavedJobsEnabled } from "@/saved-jobs/policy";
import { getCandidateSavedJobIds } from "@/saved-jobs/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PUBLIC_JOBS_LABEL,
  description: "فرصت‌های شغلی فعال در شبکه استخدامی متخصصین آکادمیک.",
};

interface PageProps {
  searchParams: Promise<PublicJobSearchParams & { application?: string | string[] }>;
}

const numberFormatter = new Intl.NumberFormat("fa-IR");

export default async function PublicJobsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const filters = parsePublicJobFilters(query);
  const [{ jobs, total, page, pageCount }, candidate] = await Promise.all([getPublicJobs(filters), getCurrentCandidate()]);
  const savingEnabled = Boolean(candidate) && isCandidateSavedJobsEnabled();
  const savedJobIds = savingEnabled && candidate ? await getCandidateSavedJobIds(candidate.id, jobs.map((job) => job.id)) : new Set<string>();
  const filtered = hasPublicJobFilters(filters);
  const applicationOutcome = Array.isArray(query.application) ? query.application[0] : query.application;

  return (
    <>
      <PublicHeader />
      <main>
        <section className="border-b border-ui-border bg-surface">
          <Container className="py-12 sm:py-16">
            <p className="text-meta text-accent">شبکه استخدامی متخصصین آکادمیک</p>
            <h1 className="text-page-title mt-2">{PUBLIC_JOBS_LABEL}</h1>
            <p className="text-secondary mt-3 max-w-2xl">فرصت‌های شغلی فعال را بر اساس عنوان، شرکت، شهر و شرایط همکاری پیدا کنید.</p>
          </Container>
        </section>

        <Container className="py-[var(--section-spacing)]">
          {applicationOutcome === "unavailable" ? <p role="alert" className="mb-5 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm font-semibold text-warning">این فرصت شغلی دیگر برای ارسال درخواست در دسترس نیست.</p> : null}
          {applicationOutcome === "invalid" ? <p role="alert" className="mb-5 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger">درخواست ارسال‌شده معتبر نبود. لطفاً فرصت شغلی را دوباره انتخاب کنید.</p> : null}
          <Card className="shadow-none">
            <form action="/jobs" method="get" className="grid gap-4 lg:grid-cols-5 lg:items-end">
              <FormField id="job-search-q" label="عنوان آگهی یا نام شرکت" className="lg:col-span-2">
                <Input name="q" type="search" maxLength={PUBLIC_JOB_QUERY_MAX_LENGTH} defaultValue={filters.q} placeholder="مثلاً توسعه‌دهنده فرانت‌اند" />
              </FormField>
              <FormField id="job-search-location" label="شهر">
                <Input name="location" maxLength={PUBLIC_JOB_LOCATION_MAX_LENGTH} defaultValue={filters.location} placeholder="مثلاً تهران" />
              </FormField>
              <FormField id="job-search-workplace" label="نوع حضور">
                <Select name="workplace" defaultValue={filters.workplace ?? ""}>
                  <option value="">همه</option>
                  {workplaceTypes.map((value) => <option key={value} value={value}>{workplaceTypeLabels[value]}</option>)}
                </Select>
              </FormField>
              <FormField id="job-search-employment" label="نوع همکاری">
                <Select name="employment" defaultValue={filters.employment ?? ""}>
                  <option value="">همه</option>
                  {employmentTypes.map((value) => <option key={value} value={value}>{employmentTypeLabels[value]}</option>)}
                </Select>
              </FormField>
              <FormField id="job-search-seniority" label="سطح ارشدیت">
                <Select name="seniority" defaultValue={filters.seniority ?? ""}>
                  <option value="">همه</option>
                  {seniorityLevels.map((value) => <option key={value} value={value}>{seniorityLevelLabels[value]}</option>)}
                </Select>
              </FormField>
              <FormField id="job-search-salary-type" label="نوع حقوق">
                <Select name="salaryType" defaultValue={filters.salaryType ?? ""}>
                  <option value="">همه</option>
                  <option value="fixed">بازه حقوق مشخص</option>
                  <option value="negotiable">حقوق توافقی</option>
                </Select>
              </FormField>
              <FormField id="job-search-min-salary" label="حداقل حقوق موردنظر" hint="تومان؛ آگهی‌های توافقی در فیلتر عددی نمایش داده نمی‌شوند.">
                <Input name="minSalary" type="number" inputMode="numeric" min={0} max={PUBLIC_JOB_SALARY_MAX} step={1} defaultValue={filters.minSalary ?? ""} placeholder="مثلاً ۲۰۰۰۰۰۰۰" dir="ltr" />
              </FormField>
              <FormField id="job-search-sort" label="مرتب‌سازی">
                <Select name="sort" defaultValue={filters.sort}>
                  <option value="newest">جدیدترین</option>
                  <option value="oldest">قدیمی‌ترین</option>
                  <option value="salary_asc">حقوق از کم به زیاد</option>
                  <option value="salary_desc">حقوق از زیاد به کم</option>
                </Select>
              </FormField>
              <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">جست‌وجوی فرصت‌ها</Button>
                {filtered ? <Link href={PUBLIC_JOBS_CLEAR_URL} className={buttonClassNames({ variant: "secondary", className: "w-full sm:w-auto" })}>پاک کردن فیلترها</Link> : null}
              </div>
            </form>
            <p className="text-helper mt-4">فیلتر حداقل حقوق، آگهی‌هایی را نشان می‌دهد که سقف بازه آن‌ها حداقل به مبلغ انتخابی می‌رسد. مرتب‌سازی حقوق بر اساس ابتدای بازه و سپس انتهای بازه است و آگهی‌های توافقی در انتهای فهرست قرار می‌گیرند.</p>
          </Card>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <p className="text-secondary">{numberFormatter.format(total)} فرصت شغلی پیدا شد</p>
            {pageCount > 1 ? <p className="text-helper">صفحه {numberFormatter.format(page)} از {numberFormatter.format(pageCount)}</p> : null}
          </div>

          {jobs.length > 0 ? (
            <section aria-label="فهرست فرصت‌های شغلی" className="mt-5 grid gap-4 md:grid-cols-2">
              {jobs.map((job) => <PublicJobCard key={job.id} job={job} savingEnabled={savingEnabled} saved={savedJobIds.has(job.id)} />)}
            </section>
          ) : (
            <Card className="mt-5 text-center shadow-none">
              <h2 className="text-card-title">{filtered ? "فرصت شغلی‌ای با این فیلترها پیدا نشد" : "در حال حاضر فرصت شغلی فعالی وجود ندارد"}</h2>
              <p className="text-secondary mt-2">{filtered ? "فیلترها را تغییر دهید یا پاک کنید." : "فرصت‌های فعال پس از انتشار در این بخش نمایش داده می‌شوند."}</p>
              {filtered ? <Link href={PUBLIC_JOBS_CLEAR_URL} className={buttonClassNames({ variant: "secondary", className: "mt-5" })}>پاک کردن فیلترها</Link> : null}
            </Card>
          )}

          {pageCount > 1 ? (
            <nav aria-label="صفحه‌بندی فرصت‌های شغلی" className="mt-7 flex items-center justify-between gap-3">
              {page > 1 ? <Link href={buildPublicJobsHref(filters, page - 1)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه قبل</Link> : <span />}
              <span className="text-sm text-text-secondary">صفحه {numberFormatter.format(page)} از {numberFormatter.format(pageCount)}</span>
              {page < pageCount ? <Link href={buildPublicJobsHref(filters, page + 1)} className={buttonClassNames({ variant: "secondary", size: "small" })}>صفحه بعد</Link> : <span />}
            </nav>
          ) : null}
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
