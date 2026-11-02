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
  deleteManagedCompanyImage,
  ImageValidationError,
  ImageStorageError,
  saveCompanyImage,
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
  const removeGallery = formData.get("removeGallery") === "true";

  if (logoFiles.length > 1 || galleryFiles.length > 6 || (removeGallery && galleryFiles.length > 0)) {
    return { status: "error", message: removeGallery && galleryFiles.length > 0 ? "حذف گالری و بارگذاری گالری جدید را هم‌زمان انتخاب نکنید." : "حداکثر یک لوگو و ۶ تصویر شرکت قابل ثبت است." };
  }

  const newlyStoredUrls: string[] = [];
  try {
    const logoUrl = logoFiles[0] ? await saveCompanyImage(logoFiles[0], "logo") : undefined;
    if (logoUrl) newlyStoredUrls.push(logoUrl);
    const galleryUrls: string[] = [];
    for (const file of galleryFiles) {
      const url = await saveCompanyImage(file, "gallery");
      newlyStoredUrls.push(url);
      galleryUrls.push(url);
    }

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
      const oldLogoUrl = existingCompany?.logoUrl ?? null;
      const nextLogoUrl = logoUrl ?? oldLogoUrl;
      const oldGallery = existingCompany && (galleryUrls.length > 0 || removeGallery)
        ? await transaction.select({ imageUrl: companyImages.imageUrl }).from(companyImages).where(eq(companyImages.companyId, existingCompany.id))
        : [];

      const [company] = await transaction
        .insert(companies)
        .values({
          employerAccountId: employer.id,
          industryId: validation.data.industryId,
          name: validation.data.name,
          address: validation.data.address,
          foundingYear: validation.data.foundingYear,
          logoUrl: nextLogoUrl,
        })
        .onConflictDoUpdate({
          target: companies.employerAccountId,
          set: {
            industryId: validation.data.industryId,
            name: validation.data.name,
            address: validation.data.address,
            foundingYear: validation.data.foundingYear,
            logoUrl: nextLogoUrl,
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

      if (galleryUrls.length > 0 || removeGallery) {
        await transaction.delete(companyImages).where(eq(companyImages.companyId, company.id));
      }
      if (galleryUrls.length > 0) {
        await transaction.insert(companyImages).values(
          galleryUrls.map((imageUrl, sortOrder) => ({ companyId: company.id, imageUrl, sortOrder })),
        );
      }

      return { success: true, oldLogoUrl: logoUrl ? oldLogoUrl : null, oldGalleryUrls: oldGallery.map((item) => item.imageUrl) } as const;
    });

    if ("error" in result) {
      await Promise.all(newlyStoredUrls.map(deleteManagedCompanyImage));
      return { status: "error", message: result.error };
    }
    await Promise.all([result.oldLogoUrl, ...result.oldGalleryUrls].map(deleteManagedCompanyImage));
  } catch (error) {
    await Promise.all(newlyStoredUrls.map(deleteManagedCompanyImage));
    if (error instanceof ImageValidationError) {
      console.warn(JSON.stringify({ event: "image_upload_rejected", code: error.code }));
      return { status: "error", message: error.message };
    }
    if (error instanceof ImageStorageError) return { status: "error", message: error.message };
    console.error(JSON.stringify({ event: "image_upload_failure", code: (error as NodeJS.ErrnoException)?.code ?? "UNKNOWN" }));
    return { status: "error", message: "ثبت اطلاعات شرکت انجام نشد. دوباره تلاش کنید." };
  }

  redirect("/employer?companySaved=1");
}
