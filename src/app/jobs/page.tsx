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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "آگهی‌ها",
  description: "آگهی‌های فعال در شبکه استخدامی متخصصین آکادمیک.",
};

interface PageProps {
  searchParams: Promise<PublicJobSearchParams>;
}

const numberFormatter = new Intl.NumberFormat("fa-IR");

export default async function PublicJobsPage({ searchParams }: PageProps) {
  const filters = parsePublicJobFilters(await searchParams);
  const { jobs, total, page, pageCount } = await getPublicJobs(filters);
  const filtered = hasPublicJobFilters(filters);

  return (
    <>
      <PublicHeader />
      <main>
        <section className="border-b border-ui-border bg-surface">
          <Container className="py-12 sm:py-16">
            <p className="text-meta text-accent">شبکه استخدامی متخصصین آکادمیک</p>
            <h1 className="text-page-title mt-2">آگهی‌ها</h1>
            <p className="text-secondary mt-3 max-w-2xl">آگهی‌های فعال را بر اساس عنوان، شرکت، شهر و شرایط همکاری پیدا کنید.</p>
          </Container>
        </section>

        <Container className="py-[var(--section-spacing)]">
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
              <div className="flex flex-col gap-2 sm:flex-row lg:col-span-4">
                <Button type="submit" className="w-full sm:w-auto">جست‌وجوی آگهی‌ها</Button>
                {filtered ? <Link href={PUBLIC_JOBS_CLEAR_URL} className={buttonClassNames({ variant: "secondary", className: "w-full sm:w-auto" })}>پاک کردن فیلترها</Link> : null}
              </div>
            </form>
          </Card>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <p className="text-secondary">{numberFormatter.format(total)} آگهی پیدا شد</p>
            {pageCount > 1 ? <p className="text-helper">صفحه {numberFormatter.format(page)} از {numberFormatter.format(pageCount)}</p> : null}
          </div>

          {jobs.length > 0 ? (
            <section aria-label="فهرست آگهی‌ها" className="mt-5 grid gap-4 md:grid-cols-2">
              {jobs.map((job) => <PublicJobCard key={job.id} job={job} />)}
            </section>
          ) : (
            <Card className="mt-5 text-center shadow-none">
              <h2 className="text-card-title">{filtered ? "آگهی‌ای با این فیلترها پیدا نشد" : "در حال حاضر آگهی فعالی وجود ندارد"}</h2>
              <p className="text-secondary mt-2">{filtered ? "فیلترها را تغییر دهید یا پاک کنید." : "آگهی‌های فعال پس از انتشار در این بخش نمایش داده می‌شوند."}</p>
              {filtered ? <Link href={PUBLIC_JOBS_CLEAR_URL} className={buttonClassNames({ variant: "secondary", className: "mt-5" })}>پاک کردن فیلترها</Link> : null}
            </Card>
          )}

          {pageCount > 1 ? (
            <nav aria-label="صفحه‌بندی آگهی‌ها" className="mt-7 flex items-center justify-between gap-3">
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
