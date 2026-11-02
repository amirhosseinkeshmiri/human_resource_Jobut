import type { Metadata } from "next";
import { requireEmployer } from "@/auth/session";
import { logoutEmployer } from "@/auth/actions";
import { CompanyOnboardingForm } from "@/components/onboarding/company-onboarding-form";
import { Button, Card, Container } from "@/components/ui";
import { employerDisplayName } from "@/auth/role-isolation-policy";
import {
  getEmployerCompanyOnboarding,
  getOnboardingReferenceData,
} from "@/onboarding/company";
import { currentIranianYear } from "@/onboarding/validation";

export const metadata: Metadata = {
  title: "تکمیل اطلاعات شرکت",
};

export default async function EmployerOnboardingPage() {
  const employer = await requireEmployer();
  const [onboarding, referenceData] = await Promise.all([
    getEmployerCompanyOnboarding(employer.id),
    getOnboardingReferenceData(),
  ]);

  const existing = onboarding.company
    ? {
        name: onboarding.company.name,
        id: onboarding.company.id,
        updatedAt: onboarding.company.updatedAt,
        industryId: onboarding.company.industryId,
        address: onboarding.company.address,
        foundingYear: onboarding.company.foundingYear,
        hasLogo: Boolean(onboarding.company.logoUrl),
        imageCount: onboarding.imageCount,
        benefitIds: onboarding.benefitIds,
      }
    : null;

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-ui-border bg-surface p-4">
            <div className="min-w-0"><p className="text-meta">حساب کارفرما</p><p className="truncate text-sm font-bold text-text-primary">{employerDisplayName(onboarding.company?.name)}</p></div>
            <form action={logoutEmployer}><Button type="submit" variant="ghost" size="small">خروج</Button></form>
          </div>
          <div className="mb-7">
            <p className="text-meta">راه‌اندازی حساب کارفرما</p>
            <h1 className="text-page-title mt-2">اطلاعات شرکت را تکمیل کنید</h1>
            <p className="text-secondary mt-3">
              این اطلاعات پایه پروفایل شرکت شما را برای مراحل بعدی تشکیل می‌دهد.
            </p>
          </div>
          <Card>
            <CompanyOnboardingForm
              industries={referenceData.industries}
              benefits={referenceData.benefits}
              existing={existing}
              maximumFoundingYear={currentIranianYear()}
              employerAccountId={employer.id}
            />
          </Card>
        </div>
      </Container>
    </main>
  );
}
