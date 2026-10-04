import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/auth/session";
import { CompanyOnboardingForm } from "@/components/onboarding/company-onboarding-form";
import { Card, Container } from "@/components/ui";
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

  if (onboarding.complete) redirect("/employer");

  const existing = onboarding.company
    ? {
        name: onboarding.company.name,
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
            />
          </Card>
        </div>
      </Container>
    </main>
  );
}
