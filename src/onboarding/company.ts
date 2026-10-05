import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  benefits,
  companies,
  companyBenefits,
  companyImages,
  industries,
} from "@/db/schema";
import { isCompanyOnboardingComplete } from "./validation";

export async function getOnboardingReferenceData() {
  const [industryOptions, benefitOptions] = await Promise.all([
    db.select({ id: industries.id, name: industries.name }).from(industries).orderBy(asc(industries.name)),
    db.select({ id: benefits.id, name: benefits.name }).from(benefits).orderBy(asc(benefits.name)),
  ]);

  return { industries: industryOptions, benefits: benefitOptions };
}

export async function getEmployerCompanyOnboarding(employerAccountId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.employerAccountId, employerAccountId))
    .limit(1);

  if (!company) return { company: null, benefitIds: [], imageCount: 0, complete: false };

  const [selectedBenefits, [gallery]] = await Promise.all([
    db
      .select({ benefitId: companyBenefits.benefitId })
      .from(companyBenefits)
      .where(eq(companyBenefits.companyId, company.id)),
    db
      .select({ count: count() })
      .from(companyImages)
      .where(eq(companyImages.companyId, company.id)),
  ]);

  const benefitIds = selectedBenefits.map((item) => item.benefitId);
  const complete = isCompanyOnboardingComplete(company);

  return { company, benefitIds, imageCount: gallery.count, complete };
}

export async function getEmployerDashboardCompany(employerAccountId: string) {
  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      address: companies.address,
      foundingYear: companies.foundingYear,
      logoUrl: companies.logoUrl,
    })
    .from(companies)
    .where(eq(companies.employerAccountId, employerAccountId))
    .limit(1);

  return company && isCompanyOnboardingComplete(company) ? company : null;
}
