import type { Metadata } from "next";
import Link from "next/link";
import { PublicJobCard } from "@/components/jobs/public-job-card";
import { IranCityCombobox } from "@/components/jobs/iran-city-combobox";
import { PublicFooter } from "@/components/landing/public-footer";
import { PublicHeader } from "@/components/landing/public-header";
import { Button, Card, Container, FormField, Input, Select, buttonClassNames } from "@/components/ui";
import { getPublicJobs } from "@/jobs/public-queries";
import {
  buildPublicJobsHref,
  hasPublicJobFilters,
  parsePublicJobFilters,
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
          <Card className="relative overflow-visible border-action/10 p-0 shadow-[0_12px_36px_rgb(20_33_145/0.07)]">
            <div className="flex flex-col gap-3 border-b border-ui-border px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div><h2 className="text-card-title">جست‌وجوی فرصت شغلی</h2><p className="text-secondary mt-1">عنوان، شرکت یا شرایط همکاری دلخواهتان را انتخاب کنید.</p></div>
              {filtered ? <span className="w-fit rounded-full bg-action/8 px-3 py-1.5 text-xs font-semibold text-action">فیلتر فعال است</span> : null}
            </div>
            <form action="/jobs" method="get">
              <fieldset className="grid min-w-0 gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-12">
                <legend className="sr-only">جست‌وجوی اصلی فرصت‌های شغلی</legend>
                <FormField id="job-search-q" label="عنوان شغل یا نام شرکت" className="min-w-0 sm:col-span-2 lg:col-span-7">
                  <Input name="q" type="search" maxLength={PUBLIC_JOB_QUERY_MAX_LENGTH} defaultValue={filters.q} placeholder="مثلاً توسعه‌دهنده فرانت‌اند یا نام شرکت" />
                </FormField>
                <FormField id="job-search-location" label="شهر" hint="نام شهر یا استان را بنویسید و از فهرست انتخاب کنید." className="min-w-0 sm:col-span-2 lg:col-span-5">
                  <IranCityCombobox name="location" defaultValue={filters.location} />
                </FormField>
              </fieldset>

              <fieldset className="grid min-w-0 gap-4 border-t border-ui-border bg-surface-elevated/55 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
                <legend className="sr-only">فیلترهای تکمیلی فرصت شغلی</legend>
                <FormField id="job-search-workplace" label="نحوه حضور">
                  <Select name="workplace" defaultValue={filters.workplace ?? ""}><option value="">همه شیوه‌های حضور</option>{workplaceTypes.map((value) => <option key={value} value={value}>{workplaceTypeLabels[value]}</option>)}</Select>
                </FormField>
                <FormField id="job-search-employment" label="نوع همکاری">
                  <Select name="employment" defaultValue={filters.employment ?? ""}><option value="">همه انواع همکاری</option>{employmentTypes.map((value) => <option key={value} value={value}>{employmentTypeLabels[value]}</option>)}</Select>
                </FormField>
                <FormField id="job-search-seniority" label="سطح ارشدیت">
                  <Select name="seniority" defaultValue={filters.seniority ?? ""}><option value="">همه سطوح</option>{seniorityLevels.map((value) => <option key={value} value={value}>{seniorityLevelLabels[value]}</option>)}</Select>
                </FormField>
                <FormField id="job-search-salary-type" label="شیوه اعلام حقوق">
                  <Select name="salaryType" defaultValue={filters.salaryType ?? ""}><option value="">همه آگهی‌ها</option><option value="fixed">بازه حقوق مشخص</option><option value="negotiable">حقوق توافقی</option></Select>
                </FormField>
                <FormField id="job-search-min-salary" label="حداقل حقوق موردنظر" hint="مبلغ به تومان؛ آگهی توافقی در فیلتر عددی نمی‌آید.">
                  <Input name="minSalary" type="number" inputMode="numeric" min={0} max={PUBLIC_JOB_SALARY_MAX} step={1} defaultValue={filters.minSalary ?? ""} placeholder="مثلاً ۲۰۰۰۰۰۰۰" dir="ltr" />
                </FormField>
                <FormField id="job-search-sort" label="مرتب‌سازی نتایج">
                  <Select name="sort" defaultValue={filters.sort}><option value="newest">جدیدترین فرصت‌ها</option><option value="oldest">قدیمی‌ترین فرصت‌ها</option><option value="salary_asc">حقوق از کم به زیاد</option><option value="salary_desc">حقوق از زیاد به کم</option></Select>
                </FormField>
              </fieldset>

              <div className="flex flex-col gap-4 border-t border-ui-border px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-helper max-w-3xl">حداقل حقوق بر اساس سقف بازه آگهی سنجیده می‌شود. در مرتب‌سازی حقوق، آگهی‌های توافقی پس از بازه‌های عددی قرار می‌گیرند.</p>
                <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
                  {filtered ? <Link href={PUBLIC_JOBS_CLEAR_URL} className={buttonClassNames({ variant: "secondary", size: "large", className: "w-full sm:w-auto" })}>پاک کردن همه فیلترها</Link> : null}
                  <Button type="submit" size="large" className="w-full px-7 sm:w-auto">نمایش فرصت‌های شغلی</Button>
                </div>
              </div>
            </form>
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
