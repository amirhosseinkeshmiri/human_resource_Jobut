import { z } from "zod";

export const workplaceTypes = ["onsite", "remote", "hybrid"] as const;
export const employmentTypes = ["full_time", "part_time", "project", "internship"] as const;
export const seniorityLevels = ["intern", "junior", "mid_level", "senior", "lead"] as const;

export const workplaceTypeLabels = {
  onsite: "حضوری",
  remote: "دورکاری",
  hybrid: "هیبرید",
} as const;

export const employmentTypeLabels = {
  full_time: "تمام‌وقت",
  part_time: "پاره‌وقت",
  project: "پروژه‌ای",
  internship: "کارآموزی",
} as const;

export const seniorityLevelLabels = {
  intern: "کارآموز",
  junior: "جونیور",
  mid_level: "میدل‌لول",
  senior: "سنیور",
  lead: "لید",
} as const;

export const JOB_SKILLS_MAX = 10;
export const JOB_SKILL_MAX_LENGTH = 50;

function descriptionText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|zwnj|#160|#8204);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const nullableSalary = z.number().int("حقوق باید عدد صحیح باشد.").min(0, "حقوق نمی‌تواند منفی باشد.").nullable();

export const jobPostFormSchema = z.object({
  title: z.string().trim().min(1, "عنوان آگهی را وارد کنید.").max(200, "عنوان آگهی بیش از حد طولانی است."),
  workplaceType: z.enum(workplaceTypes, { error: "نوع حضور معتبر نیست." }),
  employmentType: z.enum(employmentTypes, { error: "نوع همکاری معتبر نیست." }),
  location: z.string().trim().min(1, "شهر را وارد کنید.").max(160, "نام شهر بیش از حد طولانی است."),
  seniorityLevel: z.enum(seniorityLevels, { error: "سطح ارشدیت معتبر نیست." }),
  salaryMin: nullableSalary,
  salaryMax: nullableSalary,
  salaryNegotiable: z.boolean(),
  requiredSkills: z.array(
    z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(
      z.string().min(1, "مهارت خالی معتبر نیست.").max(JOB_SKILL_MAX_LENGTH, "عنوان مهارت بیش از حد طولانی است."),
    ),
  ).min(1, "حداقل یک مهارت وارد کنید.").max(JOB_SKILLS_MAX, "حداکثر ۱۰ مهارت مجاز است."),
  description: z.string().max(30_000, "توضیحات شغل بیش از حد طولانی است.").refine(
    (value) => descriptionText(value).length > 0,
    "توضیحات شغل را وارد کنید.",
  ),
}).superRefine((data, context) => {
  const normalizedSkills = new Set<string>();
  data.requiredSkills.forEach((skill, index) => {
    const key = skill.toLocaleLowerCase("fa-IR");
    if (normalizedSkills.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["requiredSkills", index],
        message: "مهارت تکراری است.",
      });
    }
    normalizedSkills.add(key);
  });

  if (!data.salaryNegotiable) {
    if (data.salaryMin === null) {
      context.addIssue({ code: "custom", path: ["salaryMin"], message: "حداقل حقوق را وارد کنید." });
    }
    if (data.salaryMax === null) {
      context.addIssue({ code: "custom", path: ["salaryMax"], message: "حداکثر حقوق را وارد کنید." });
    }
    if (data.salaryMin !== null && data.salaryMax !== null && data.salaryMax < data.salaryMin) {
      context.addIssue({ code: "custom", path: ["salaryMax"], message: "حداکثر حقوق باید از حداقل حقوق کمتر نباشد." });
    }
  }
});

export type JobPostFormValues = z.infer<typeof jobPostFormSchema>;

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return Number(value);
}

export function jobPostValuesFromFormData(formData: FormData) {
  const salaryNegotiable = formData.get("salaryNegotiable") === "true";
  return {
    title: formData.get("title"),
    workplaceType: formData.get("workplaceType"),
    employmentType: formData.get("employmentType"),
    location: formData.get("location"),
    seniorityLevel: formData.get("seniorityLevel"),
    salaryMin: salaryNegotiable ? null : optionalNumber(formData.get("salaryMin")),
    salaryMax: salaryNegotiable ? null : optionalNumber(formData.get("salaryMax")),
    salaryNegotiable,
    requiredSkills: formData.getAll("requiredSkills"),
    description: formData.get("description"),
  };
}
