import { z } from "zod";

export const RESUME_SKILLS_MAX = 10;
export const RESUME_SKILL_MAX_LENGTH = 50;
export const RESUME_NESTED_ITEMS_MAX = 30;
export const languageProficiencies = ["basic", "intermediate", "advanced", "fluent", "native"] as const;
export const languageProficiencyLabels: Record<(typeof languageProficiencies)[number], string> = {
  basic: "مقدماتی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
  fluent: "مسلط",
  native: "زبان مادری",
};

const requiredShortText = (label: string, maximum: number) => z.string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, `${label} را وارد کنید.`).max(maximum, `${label} بیش از حد طولانی است.`));

const dateValue = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "تاریخ معتبر نیست.");

function nullableText(maximum: number) {
  return z.string().trim().max(maximum, "متن بیش از حد طولانی است.").transform((value) => value || null);
}

function optionalUrl(kind: "linkedin" | "portfolio") {
  return z.string().trim().max(2_000, "نشانی اینترنتی بیش از حد طولانی است.").refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      if (kind === "linkedin") return url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
      return true;
    } catch {
      return false;
    }
  }, kind === "linkedin" ? "نشانی لینکدین معتبر نیست." : "نشانی نمونه‌کار معتبر نیست.").transform((value) => value || null);
}

function validateDates(data: { startDate: string; endDate: string | null; isCurrent: boolean }, context: z.RefinementCtx) {
  if (data.isCurrent) {
    if (data.endDate !== null) context.addIssue({ code: "custom", path: ["endDate"], message: "برای مورد جاری تاریخ پایان وارد نکنید." });
    return;
  }
  if (!data.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "تاریخ پایان را وارد کنید." });
  } else if (data.endDate < data.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد." });
  }
}

export const resumeExperienceSchema = z.object({
  jobTitle: requiredShortText("عنوان شغلی", 160),
  companyName: requiredShortText("نام شرکت یا سازمان", 200),
  startDate: dateValue,
  endDate: z.union([dateValue, z.literal("")]).nullable().transform((value) => value || null),
  isCurrent: z.boolean(),
  description: nullableText(2_000),
}).superRefine(validateDates);

export const resumeEducationSchema = z.object({
  fieldOfStudy: requiredShortText("رشته تحصیلی", 160),
  institutionName: requiredShortText("دانشگاه یا مؤسسه", 200),
  degree: requiredShortText("مقطع تحصیلی", 120),
  startDate: dateValue,
  endDate: z.union([dateValue, z.literal("")]).nullable().transform((value) => value || null),
  isCurrent: z.boolean(),
}).superRefine(validateDates);

export const resumeLanguageSchema = z.object({
  name: requiredShortText("نام زبان", 100),
  proficiency: z.enum(languageProficiencies, { error: "سطح زبان معتبر نیست." }),
});

export const candidateResumeSchema = z.object({
  firstName: requiredShortText("نام", 100),
  lastName: requiredShortText("نام خانوادگی", 120),
  city: requiredShortText("شهر", 160),
  professionalTitle: requiredShortText("عنوان حرفه‌ای", 160),
  professionalSummary: z.string().trim().min(1, "خلاصه حرفه‌ای را وارد کنید.").max(2_000, "خلاصه حرفه‌ای بیش از حد طولانی است."),
  skills: z.array(z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(
    z.string().min(1, "مهارت خالی معتبر نیست.").max(RESUME_SKILL_MAX_LENGTH, "عنوان مهارت بیش از حد طولانی است."),
  )).min(1, "حداقل یک مهارت وارد کنید.").max(RESUME_SKILLS_MAX, "حداکثر ۱۰ مهارت مجاز است."),
  linkedinUrl: optionalUrl("linkedin"),
  portfolioUrl: optionalUrl("portfolio"),
  experiences: z.array(resumeExperienceSchema).max(RESUME_NESTED_ITEMS_MAX, "تعداد سوابق شغلی بیش از حد مجاز است."),
  educations: z.array(resumeEducationSchema).max(RESUME_NESTED_ITEMS_MAX, "تعداد سوابق تحصیلی بیش از حد مجاز است."),
  languages: z.array(resumeLanguageSchema).max(RESUME_NESTED_ITEMS_MAX, "تعداد زبان‌ها بیش از حد مجاز است."),
}).superRefine((data, context) => {
  const skillNames = new Set<string>();
  data.skills.forEach((skill, index) => {
    const normalized = skill.toLocaleLowerCase("fa-IR");
    if (skillNames.has(normalized)) context.addIssue({ code: "custom", path: ["skills", index], message: "مهارت تکراری است." });
    skillNames.add(normalized);
  });
  const languageNames = new Set<string>();
  data.languages.forEach((language, index) => {
    const normalized = language.name.toLocaleLowerCase("fa-IR");
    if (languageNames.has(normalized)) context.addIssue({ code: "custom", path: ["languages", index, "name"], message: "این زبان قبلاً اضافه شده است." });
    languageNames.add(normalized);
  });
});

export type CandidateResumeInput = z.input<typeof candidateResumeSchema>;
export type CandidateResumeValues = z.output<typeof candidateResumeSchema>;
