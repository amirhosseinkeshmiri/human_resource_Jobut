import { toLatinDigits } from "@/auth/identifier";

export interface CompanyOnboardingInput {
  name: string;
  industryId: string;
  address: string;
  foundingYear: number;
  benefitIds: string[];
}

export type CompanyOnboardingValidation =
  | { success: true; data: CompanyOnboardingInput }
  | { success: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function currentIranianYear(date = new Date()) {
  return date.getUTCFullYear() - 621;
}

export function validateCompanyOnboardingForm(
  formData: FormData,
  now = new Date(),
): CompanyOnboardingValidation {
  const name = String(formData.get("name") ?? "").trim();
  const industryId = String(formData.get("industryId") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const foundingYearText = toLatinDigits(String(formData.get("foundingYear") ?? "").trim());
  const foundingYear = Number(foundingYearText);
  const benefitIds = [...new Set(formData.getAll("benefitIds").map(String))];

  if (name.length < 2 || name.length > 200) {
    return { success: false, message: "نام شرکت باید بین ۲ تا ۲۰۰ نویسه باشد." };
  }
  if (!UUID_PATTERN.test(industryId)) {
    return { success: false, message: "حوزه فعالیت معتبر را انتخاب کنید." };
  }
  if (address.length < 5 || address.length > 1000) {
    return { success: false, message: "نشانی شرکت باید بین ۵ تا ۱۰۰۰ نویسه باشد." };
  }
  if (
    !Number.isInteger(foundingYear) ||
    foundingYear < 1200 ||
    foundingYear > currentIranianYear(now)
  ) {
    return {
      success: false,
      message: `سال تأسیس باید بین ۱۲۰۰ تا ${currentIranianYear(now)} شمسی باشد.`,
    };
  }
  if (benefitIds.some((id) => !UUID_PATTERN.test(id))) {
    return { success: false, message: "یک یا چند مزیت انتخاب‌شده معتبر نیست." };
  }

  return {
    success: true,
    data: { name, industryId, address, foundingYear, benefitIds },
  };
}

export function isCompanyOnboardingComplete(company: {
  name: string;
  address: string;
  foundingYear: number | null;
  logoUrl: string | null;
}) {
  return Boolean(
    company.name.trim() && company.address.trim() && company.foundingYear && company.logoUrl,
  );
}
