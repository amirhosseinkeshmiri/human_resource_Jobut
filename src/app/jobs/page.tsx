import type { Metadata } from "next";
import { PublicFooter } from "@/components/landing/public-footer";
import { PublicHeader } from "@/components/landing/public-header";
import { PublicJobCard } from "@/components/jobs/public-job-card";
import { Card, Container } from "@/components/ui";
import { getPublicJobs } from "@/jobs/public-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "آگهی‌ها",
  description: "آگهی‌های فعال در شبکه استخدامی متخصصین آکادمیک.",
};

export default async function PublicJobsPage() {
  const jobs = await getPublicJobs();

  return (
    <>
      <PublicHeader />
      <main>
        <section className="border-b border-ui-border bg-surface">
          <Container className="py-12 sm:py-16">
            <p className="text-meta text-accent">شبکه استخدامی متخصصین آکادمیک</p>
            <h1 className="text-page-title mt-2">آگهی‌ها</h1>
            <p className="text-secondary mt-3 max-w-2xl">آگهی‌های فعال منتشرشده در شبکه استخدامی متخصصین آکادمیک را مشاهده کنید.</p>
          </Container>
        </section>

        <Container className="py-[var(--section-spacing)]">
          {jobs.length > 0 ? (
            <section aria-label="فهرست آگهی‌ها" className="grid gap-4 md:grid-cols-2">
              {jobs.map((job) => <PublicJobCard key={job.id} job={job} />)}
            </section>
          ) : (
            <Card className="mx-auto max-w-2xl text-center shadow-none">
              <h2 className="text-card-title">در حال حاضر آگهی فعالی وجود ندارد</h2>
              <p className="text-secondary mt-2">آگهی‌های فعال پس از انتشار در این بخش نمایش داده می‌شوند.</p>
            </Card>
          )}
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
