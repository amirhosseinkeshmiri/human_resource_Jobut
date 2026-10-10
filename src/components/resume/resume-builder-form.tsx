"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type KeyboardEvent } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button, Card, FormField, Input, Select, Textarea } from "@/components/ui";
import {
  candidateResumeSchema,
  languageProficiencies,
  languageProficiencyLabels,
  RESUME_SKILLS_MAX,
  type CandidateResumeInput,
  type CandidateResumeValues,
} from "@/resume/validation";

interface ResumeBuilderFormProps {
  action: (formData: FormData) => Promise<void>;
  initialValues?: CandidateResumeInput;
  serverError?: string;
}

const emptyExperience = { jobTitle: "", companyName: "", startDate: "", endDate: "", isCurrent: false, description: "" };
const emptyEducation = { fieldOfStudy: "", institutionName: "", degree: "", startDate: "", endDate: "", isCurrent: false };
const emptyLanguage = { name: "", proficiency: "intermediate" as const };

export function ResumeBuilderForm({ action, initialValues, serverError }: ResumeBuilderFormProps) {
  const [skillInput, setSkillInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CandidateResumeInput, unknown, CandidateResumeValues>({
    resolver: zodResolver(candidateResumeSchema),
    defaultValues: initialValues ?? {
      firstName: "", lastName: "", city: "", professionalTitle: "", professionalSummary: "",
      skills: [], linkedinUrl: "", portfolioUrl: "", experiences: [], educations: [], languages: [],
    },
  });
  const experiences = useFieldArray({ control, name: "experiences" });
  const educations = useFieldArray({ control, name: "educations" });
  const languages = useFieldArray({ control, name: "languages" });
  const skills = useWatch({ control, name: "skills" }) ?? [];
  const experienceValues = useWatch({ control, name: "experiences" }) ?? [];
  const educationValues = useWatch({ control, name: "educations" }) ?? [];

  function addSkill() {
    const skill = skillInput.trim().replace(/\s+/g, " ");
    if (!skill) return;
    if (skills.length >= RESUME_SKILLS_MAX) return setError("skills", { message: "حداکثر ۱۰ مهارت مجاز است." });
    if (skills.some((item) => item.toLocaleLowerCase("fa-IR") === skill.toLocaleLowerCase("fa-IR"))) return setError("skills", { message: "این مهارت قبلاً اضافه شده است." });
    setValue("skills", [...skills, skill], { shouldDirty: true, shouldValidate: true });
    clearErrors("skills");
    setSkillInput("");
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "،") {
      event.preventDefault();
      addSkill();
    }
  }

  function submit(values: CandidateResumeValues) {
    const formData = new FormData();
    formData.set("resumePayload", JSON.stringify(values));
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-6" noValidate>
      {serverError ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{serverError}</p> : null}

      <Card className="shadow-none"><h2 className="text-section-title">اطلاعات پایه</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <FormField id="resume-first-name" label="نام" required error={errors.firstName?.message}><Input {...register("firstName")} maxLength={100} autoComplete="given-name" /></FormField>
        <FormField id="resume-last-name" label="نام خانوادگی" required error={errors.lastName?.message}><Input {...register("lastName")} maxLength={120} autoComplete="family-name" /></FormField>
        <FormField id="resume-city" label="شهر" required error={errors.city?.message}><Input {...register("city")} maxLength={160} autoComplete="address-level2" /></FormField>
        <FormField id="resume-professional-title" label="عنوان حرفه‌ای" required error={errors.professionalTitle?.message}><Input {...register("professionalTitle")} maxLength={160} placeholder="مثلاً توسعه‌دهنده بک‌اند" /></FormField>
      </div></Card>

      <Card className="shadow-none"><h2 className="text-section-title">درباره من</h2><div className="mt-5"><FormField id="resume-summary" label="درباره من / خلاصه حرفه‌ای" required error={errors.professionalSummary?.message}><Textarea {...register("professionalSummary")} rows={6} maxLength={2000} /></FormField></div></Card>

      <Card className="shadow-none"><h2 className="text-section-title">مهارت‌ها</h2><div className="mt-5 grid gap-2"><label htmlFor="resume-skill" className="text-label">مهارت <span className="text-danger">*</span></label><div className="flex flex-col gap-2 sm:flex-row"><Input id="resume-skill" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={handleSkillKeyDown} maxLength={50} placeholder="با Enter یا ویرگول اضافه کنید" /><Button type="button" variant="secondary" onClick={addSkill}>افزودن</Button></div><p className="text-helper">حداقل ۱ و حداکثر ۱۰ مهارت</p>{skills.length ? <div className="flex flex-wrap gap-2" aria-label="مهارت‌های رزومه">{skills.map((skill, index) => <span key={`${skill}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5 text-sm ring-1 ring-inset ring-ui-border">{skill}<button type="button" onClick={() => setValue("skills", skills.filter((_, itemIndex) => itemIndex !== index), { shouldValidate: true, shouldDirty: true })} aria-label={`حذف مهارت ${skill}`} className="rounded text-text-muted outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-focus">×</button></span>)}</div> : null}{errors.skills?.message ? <p className="text-helper text-danger">{errors.skills.message}</p> : null}</div></Card>

      <Card className="shadow-none"><div className="flex items-center justify-between gap-3"><div><h2 className="text-section-title">سوابق شغلی</h2><p className="text-helper mt-1">برای افراد بدون سابقه اختیاری است.</p></div><Button type="button" variant="secondary" size="small" onClick={() => experiences.append(emptyExperience)}>افزودن سابقه</Button></div><div className="mt-5 grid gap-4">{experiences.fields.map((field, index) => <fieldset key={field.id} className="rounded-lg border border-ui-border p-4"><legend className="px-2 text-sm font-semibold">سابقه {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><FormField id={`experience-${index}-title`} label="عنوان شغلی" required error={errors.experiences?.[index]?.jobTitle?.message}><Input {...register(`experiences.${index}.jobTitle`)} maxLength={160} /></FormField><FormField id={`experience-${index}-company`} label="نام شرکت / سازمان" required error={errors.experiences?.[index]?.companyName?.message}><Input {...register(`experiences.${index}.companyName`)} maxLength={200} /></FormField><FormField id={`experience-${index}-start`} label="تاریخ شروع" required error={errors.experiences?.[index]?.startDate?.message}><Input type="date" dir="ltr" {...register(`experiences.${index}.startDate`)} /></FormField><FormField id={`experience-${index}-end`} label="تاریخ پایان" required={!experienceValues[index]?.isCurrent} error={errors.experiences?.[index]?.endDate?.message}><Input type="date" dir="ltr" disabled={experienceValues[index]?.isCurrent} {...register(`experiences.${index}.endDate`)} /></FormField></div><label className="mt-4 flex min-h-10 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-4 accent-action" {...register(`experiences.${index}.isCurrent`, { onChange: (event) => { if (event.target.checked) setValue(`experiences.${index}.endDate`, null, { shouldValidate: true }); } })} />همچنان مشغول به کار هستم</label><div className="mt-4"><FormField id={`experience-${index}-description`} label="توضیحات" error={errors.experiences?.[index]?.description?.message}><Textarea {...register(`experiences.${index}.description`)} rows={3} maxLength={2000} /></FormField></div><Button type="button" variant="ghost" size="small" className="mt-3 text-danger" onClick={() => experiences.remove(index)}>حذف سابقه</Button></fieldset>)}</div></Card>

      <Card className="shadow-none"><div className="flex items-center justify-between gap-3"><div><h2 className="text-section-title">تحصیلات</h2><p className="text-helper mt-1">ثبت تحصیلات اختیاری است.</p></div><Button type="button" variant="secondary" size="small" onClick={() => educations.append(emptyEducation)}>افزودن تحصیلات</Button></div><div className="mt-5 grid gap-4">{educations.fields.map((field, index) => <fieldset key={field.id} className="rounded-lg border border-ui-border p-4"><legend className="px-2 text-sm font-semibold">تحصیلات {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><FormField id={`education-${index}-field`} label="رشته تحصیلی" required error={errors.educations?.[index]?.fieldOfStudy?.message}><Input {...register(`educations.${index}.fieldOfStudy`)} maxLength={160} /></FormField><FormField id={`education-${index}-institution`} label="دانشگاه / مؤسسه" required error={errors.educations?.[index]?.institutionName?.message}><Input {...register(`educations.${index}.institutionName`)} maxLength={200} /></FormField><FormField id={`education-${index}-degree`} label="مقطع تحصیلی" required error={errors.educations?.[index]?.degree?.message}><Input {...register(`educations.${index}.degree`)} maxLength={120} /></FormField><FormField id={`education-${index}-start`} label="تاریخ شروع" required error={errors.educations?.[index]?.startDate?.message}><Input type="date" dir="ltr" {...register(`educations.${index}.startDate`)} /></FormField><FormField id={`education-${index}-end`} label="تاریخ پایان" required={!educationValues[index]?.isCurrent} error={errors.educations?.[index]?.endDate?.message}><Input type="date" dir="ltr" disabled={educationValues[index]?.isCurrent} {...register(`educations.${index}.endDate`)} /></FormField></div><label className="mt-4 flex min-h-10 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-4 accent-action" {...register(`educations.${index}.isCurrent`, { onChange: (event) => { if (event.target.checked) setValue(`educations.${index}.endDate`, null, { shouldValidate: true }); } })} />همچنان در حال تحصیل هستم</label><Button type="button" variant="ghost" size="small" className="mt-3 text-danger" onClick={() => educations.remove(index)}>حذف تحصیلات</Button></fieldset>)}</div></Card>

      <Card className="shadow-none"><div className="flex items-center justify-between gap-3"><div><h2 className="text-section-title">زبان‌ها</h2><p className="text-helper mt-1">ثبت زبان اختیاری است.</p></div><Button type="button" variant="secondary" size="small" onClick={() => languages.append(emptyLanguage)}>افزودن زبان</Button></div><div className="mt-5 grid gap-4">{languages.fields.map((field, index) => <fieldset key={field.id} className="rounded-lg border border-ui-border p-4"><legend className="px-2 text-sm font-semibold">زبان {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><FormField id={`language-${index}-name`} label="نام زبان" required error={errors.languages?.[index]?.name?.message}><Input {...register(`languages.${index}.name`)} maxLength={100} /></FormField><FormField id={`language-${index}-proficiency`} label="سطح تسلط" required error={errors.languages?.[index]?.proficiency?.message}><Select {...register(`languages.${index}.proficiency`)}>{languageProficiencies.map((value) => <option key={value} value={value}>{languageProficiencyLabels[value]}</option>)}</Select></FormField></div><Button type="button" variant="ghost" size="small" className="mt-3 text-danger" onClick={() => languages.remove(index)}>حذف زبان</Button></fieldset>)}</div></Card>

      <Card className="shadow-none"><h2 className="text-section-title">لینک‌های حرفه‌ای</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><FormField id="resume-linkedin" label="لینکدین" error={errors.linkedinUrl?.message}><Input type="url" dir="ltr" placeholder="https://linkedin.com/in/..." {...register("linkedinUrl")} /></FormField><FormField id="resume-portfolio" label="نمونه‌کار" error={errors.portfolioUrl?.message}><Input type="url" dir="ltr" placeholder="https://example.com" {...register("portfolioUrl")} /></FormField></div></Card>

      <div className="sticky bottom-3 z-10 rounded-lg border border-ui-border bg-surface/95 p-3 shadow-lg backdrop-blur sm:flex sm:justify-end"><Button type="submit" loading={isPending} className="w-full sm:w-auto">ذخیره رزومه</Button></div>
    </form>
  );
}
