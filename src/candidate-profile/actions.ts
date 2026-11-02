"use server";

import { revalidatePath } from "next/cache";
import { requireCandidate } from "@/candidate-auth/session";
import { isTrustedAuthActionRequest } from "@/auth/request-security";
import { candidateBasicProfileSchema, type CandidateBasicProfileInput } from "@/resume/validation";
import { updateCandidateBasicProfile } from "./repository";

export interface CandidateProfileActionState {
  status: "idle" | "success" | "error";
  message?: string;
  values?: CandidateBasicProfileInput;
  fieldErrors?: Partial<Record<keyof CandidateBasicProfileInput, string>>;
}

function submittedValues(formData: FormData): CandidateBasicProfileInput {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    city: String(formData.get("city") ?? ""),
    professionalTitle: String(formData.get("professionalTitle") ?? ""),
    professionalSummary: String(formData.get("professionalSummary") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    portfolioUrl: String(formData.get("portfolioUrl") ?? ""),
  };
}

export async function saveCandidateBasicProfile(
  _previousState: CandidateProfileActionState,
  formData: FormData,
): Promise<CandidateProfileActionState> {
  const candidate = await requireCandidate();
  const values = submittedValues(formData);
  if (!(await isTrustedAuthActionRequest())) {
    return { status: "error", message: "درخواست معتبر نیست. صفحه را تازه‌سازی و دوباره تلاش کنید.", values };
  }
  const parsed = candidateBasicProfileSchema.safeParse(values);
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened).map(([field, errors]) => [field, errors?.[0]]),
    ) as CandidateProfileActionState["fieldErrors"];
    return { status: "error", message: "لطفاً خطاهای فرم را اصلاح کنید.", values, fieldErrors };
  }
  try {
    const updated = await updateCandidateBasicProfile(candidate.id, candidate.id, parsed.data);
    if (!updated) {
      return { status: "error", message: "ابتدا رزومه خود را ایجاد کنید.", values };
    }
  } catch {
    return { status: "error", message: "ذخیره پروفایل انجام نشد. اطلاعات واردشده حفظ شده است؛ دوباره تلاش کنید.", values };
  }
  revalidatePath("/candidate");
  revalidatePath("/candidate/profile");
  revalidatePath("/candidate/resume");
  return {
    status: "success",
    message: "پروفایل با موفقیت ذخیره شد.",
    values: {
      ...parsed.data,
      linkedinUrl: parsed.data.linkedinUrl ?? "",
      portfolioUrl: parsed.data.portfolioUrl ?? "",
    },
  };
}
