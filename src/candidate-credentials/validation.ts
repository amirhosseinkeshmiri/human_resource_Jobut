import { z } from "zod";

export const credentialRecordTypes = ["certificate", "training_course", "supporting_credential"] as const;
export const credentialRecordTypeLabels: Record<(typeof credentialRecordTypes)[number], string> = {
  certificate: "گواهی حرفه‌ای",
  training_course: "دوره آموزشی",
  supporting_credential: "مدرک تکمیلی",
};
export const MAX_CANDIDATE_CREDENTIALS = 20;

const cleanRequired = (label: string) => z.string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, `${label} را وارد کنید.`).max(200, `${label} بیش از حد طولانی است.`));
const optionalDate = z.union([z.literal(""), z.iso.date()]).transform((value) => value || null);
const optionalText = (maximum: number) => z.string().trim().max(maximum, "متن بیش از حد طولانی است.").transform((value) => value || null);

export const candidateCredentialSchema = z.object({
  recordType: z.enum(credentialRecordTypes, { error: "نوع سابقه معتبر نیست." }),
  title: cleanRequired("عنوان"),
  issuer: cleanRequired("سازمان صادرکننده یا برگزارکننده"),
  issueDate: optionalDate,
  expirationDate: optionalDate,
  credentialId: optionalText(200),
  verificationUrl: z.string().trim().max(2_000, "نشانی اعتبارسنجی بیش از حد طولانی است.").refine((value) => {
    if (!value) return true;
    try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
  }, "نشانی اعتبارسنجی معتبر نیست.").transform((value) => value || null),
  description: optionalText(1_000),
}).superRefine((value, context) => {
  if (value.issueDate && value.expirationDate && value.expirationDate < value.issueDate) {
    context.addIssue({ code: "custom", path: ["expirationDate"], message: "تاریخ انقضا نمی‌تواند پیش از تاریخ صدور باشد." });
  }
});

export type CandidateCredentialInput = z.input<typeof candidateCredentialSchema>;
export type CandidateCredentialValues = z.output<typeof candidateCredentialSchema>;
