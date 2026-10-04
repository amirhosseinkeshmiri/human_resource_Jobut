"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/auth/session";
import { db } from "@/db";
import {
  benefits,
  companies,
  companyBenefits,
  companyImages,
  industries,
} from "@/db/schema";
import {
  ImageValidationError,
  saveDevelopmentCompanyImage,
  selectedFiles,
} from "./image-storage";
import { validateCompanyOnboardingForm } from "./validation";

export interface OnboardingActionState {
  status: "idle" | "error";
  message?: string;
}

export async function saveCompanyOnboarding(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const employer = await requireEmployer();
  const validation = validateCompanyOnboardingForm(formData);
  if (!validation.success) return { status: "error", message: validation.message };

  const logoFiles = selectedFiles([formData.get("logo")].filter(Boolean) as FormDataEntryValue[]);
  const galleryFiles = selectedFiles(formData.getAll("gallery"));

  if (logoFiles.length > 1 || galleryFiles.length > 6) {
    return { status: "error", message: "حداکثر یک لوگو و ۶ تصویر شرکت قابل ثبت است." };
  }

  try {
    const result = await db.transaction(async (transaction) => {
      const [[industry], validBenefits, [existingCompany]] = await Promise.all([
        transaction
          .select({ id: industries.id })
          .from(industries)
          .where(eq(industries.id, validation.data.industryId))
          .limit(1),
        validation.data.benefitIds.length > 0
          ? transaction
              .select({ id: benefits.id })
              .from(benefits)
              .where(inArray(benefits.id, validation.data.benefitIds))
          : Promise.resolve([]),
        transaction
          .select()
          .from(companies)
          .where(eq(companies.employerAccountId, employer.id))
          .limit(1)
          .for("update"),
      ]);

      if (!industry) return { error: "حوزه فعالیت انتخاب‌شده معتبر نیست." } as const;
      if (validBenefits.length !== validation.data.benefitIds.length) {
        return { error: "یک یا چند مزیت انتخاب‌شده معتبر نیست." } as const;
      }

      if (!existingCompany?.logoUrl && logoFiles.length === 0) {
        return { error: "انتخاب لوگوی مربع شرکت الزامی است." } as const;
      }
      const logoUrl = logoFiles[0]
        ? await saveDevelopmentCompanyImage(logoFiles[0], "logo")
        : existingCompany?.logoUrl;
      const galleryUrls = await Promise.all(
        galleryFiles.map((file) => saveDevelopmentCompanyImage(file, "gallery")),
      );

      const [company] = await transaction
        .insert(companies)
        .values({
          employerAccountId: employer.id,
          industryId: validation.data.industryId,
          name: validation.data.name,
          address: validation.data.address,
          foundingYear: validation.data.foundingYear,
          logoUrl,
        })
        .onConflictDoUpdate({
          target: companies.employerAccountId,
          set: {
            industryId: validation.data.industryId,
            name: validation.data.name,
            address: validation.data.address,
            foundingYear: validation.data.foundingYear,
            logoUrl,
            updatedAt: new Date(),
          },
        })
        .returning({ id: companies.id });

      await transaction.delete(companyBenefits).where(eq(companyBenefits.companyId, company.id));
      if (validation.data.benefitIds.length > 0) {
        await transaction.insert(companyBenefits).values(
          validation.data.benefitIds.map((benefitId) => ({ companyId: company.id, benefitId })),
        );
      }

      if (galleryUrls.length > 0) {
        await transaction.delete(companyImages).where(eq(companyImages.companyId, company.id));
        await transaction.insert(companyImages).values(
          galleryUrls.map((imageUrl, sortOrder) => ({ companyId: company.id, imageUrl, sortOrder })),
        );
      }

      return { success: true } as const;
    });

    if ("error" in result) return { status: "error", message: result.error };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "ثبت اطلاعات شرکت انجام نشد. دوباره تلاش کنید." };
  }

  redirect("/employer");
}
