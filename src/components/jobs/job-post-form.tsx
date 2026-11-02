"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, useTransition, type BaseSyntheticEvent, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, FormField, Input, Select } from "@/components/ui";
import { clearFormDraft, loadFormDraft, saveFormDraft, type FormDraftOptions } from "@/forms/form-draft";
import {
  employmentTypeLabels,
  employmentTypes,
  JOB_SKILLS_MAX,
  jobPostFormSchema,
  seniorityLevelLabels,
  seniorityLevels,
  workplaceTypeLabels,
  workplaceTypes,
  type JobPostFormValues,
} from "@/jobs/validation";

export interface JobPostFormDefaults {
  title?: string;
  workplaceType?: JobPostFormValues["workplaceType"] | null;
  employmentType?: JobPostFormValues["employmentType"] | null;
  location?: string | null;
  seniorityLevel?: JobPostFormValues["seniorityLevel"] | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
  requiredSkills?: string[] | null;
  description?: string | null;
}

interface JobPostFormProps {
  action: (formData: FormData) => Promise<void>;
  initialValues?: JobPostFormDefaults;
  submitLabel: string;
  serverError?: string;
  draftAccountId: string;
  draftEntityId: string;
  draftBaselineUpdatedAt?: number;
  clearDraftEntityId?: string;
  submissionSucceeded?: boolean;
}

const JOB_DRAFT_FIELDS = [
  "title",
  "workplaceType",
  "employmentType",
  "location",
  "seniorityLevel",
  "salaryMin",
  "salaryMax",
  "salaryNegotiable",
  "requiredSkills",
  "description",
] as const;

function sanitizeEditorDraftHtml(value: unknown) {
  const template = document.createElement("template");
  template.innerHTML = typeof value === "string" ? value : "";
  const allowedTags = new Set(["P", "BR", "STRONG", "B", "UL", "OL", "LI"]);
  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  }
  return template.innerHTML;
}

export function JobPostForm({
  action,
  initialValues,
  submitLabel,
  serverError,
  draftAccountId,
  draftEntityId,
  draftBaselineUpdatedAt = 0,
  clearDraftEntityId,
  submissionSucceeded = false,
}: JobPostFormProps) {
  const [skillInput, setSkillInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const editorRef = useRef<HTMLDivElement>(null);
  const skipNextDraftSaveRef = useRef(false);
  const pendingDraftSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialFormValues = useMemo(() => ({
    title: initialValues?.title ?? "",
    workplaceType: initialValues?.workplaceType ?? undefined,
    employmentType: initialValues?.employmentType ?? undefined,
    location: initialValues?.location ?? "",
    seniorityLevel: initialValues?.seniorityLevel ?? undefined,
    salaryMin: initialValues?.salaryMin ?? null,
    salaryMax: initialValues?.salaryMax ?? null,
    salaryNegotiable: initialValues?.salaryNegotiable ?? false,
    requiredSkills: initialValues?.requiredSkills ?? [],
    description: initialValues?.description ?? "",
  }), [initialValues]);
  const draftOptions = useMemo<FormDraftOptions>(() => ({
    scope: { accountId: draftAccountId, formId: "job-post", entityId: draftEntityId },
    allowedFields: JOB_DRAFT_FIELDS,
  }), [draftAccountId, draftEntityId]);
  const {
    register,
    setValue,
    setError,
    clearErrors,
    handleSubmit,
    control,
    reset,
    subscribe,
    formState: { errors, isDirty },
  } = useForm<JobPostFormValues>({
    resolver: zodResolver(jobPostFormSchema),
    defaultValues: initialFormValues,
  });

  const skills = useWatch({ control, name: "requiredSkills" });
  const salaryNegotiable = useWatch({ control, name: "salaryNegotiable" });
  const description = useWatch({ control, name: "description" });

  useEffect(() => {
    if (submissionSucceeded) {
      clearFormDraft(window.localStorage, draftOptions.scope);
      return;
    }
    if (clearDraftEntityId) {
      clearFormDraft(window.localStorage, { ...draftOptions.scope, entityId: clearDraftEntityId });
    }
    if (isDirty) return;
    const draft = loadFormDraft<JobPostFormValues>(window.localStorage, draftOptions, draftBaselineUpdatedAt);
    if (!draft) return;
    const restored = {
      ...initialFormValues,
      ...draft.values,
      description: sanitizeEditorDraftHtml(draft.values.description),
    };
    reset(restored);
    if (editorRef.current) editorRef.current.innerHTML = restored.description ?? "";
  }, [clearDraftEntityId, draftBaselineUpdatedAt, draftOptions, initialFormValues, isDirty, reset, submissionSucceeded]);

  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (skipNextDraftSaveRef.current) {
          skipNextDraftSaveRef.current = false;
          return;
        }
        if (pendingDraftSaveRef.current) clearTimeout(pendingDraftSaveRef.current);
        pendingDraftSaveRef.current = setTimeout(() => {
          saveFormDraft(window.localStorage, draftOptions, values as Record<string, unknown>);
          pendingDraftSaveRef.current = undefined;
        }, 350);
      },
    });
    return () => {
      if (pendingDraftSaveRef.current) clearTimeout(pendingDraftSaveRef.current);
      unsubscribe();
    };
  }, [draftOptions, subscribe]);

  function discardDraft() {
    if (pendingDraftSaveRef.current) {
      clearTimeout(pendingDraftSaveRef.current);
      pendingDraftSaveRef.current = undefined;
    }
    clearFormDraft(window.localStorage, draftOptions.scope);
    skipNextDraftSaveRef.current = true;
    reset(initialFormValues);
    queueMicrotask(() => { skipNextDraftSaveRef.current = false; });
    setSkillInput("");
    if (editorRef.current) editorRef.current.innerHTML = initialFormValues.description ?? "";
  }

  function addSkill() {
    const skill = skillInput.trim().replace(/\s+/g, " ");
    if (!skill) return;
    if (skills.length >= JOB_SKILLS_MAX) {
      setError("requiredSkills", { message: "حداکثر ۱۰ مهارت مجاز است." });
      return;
    }
    if (skills.some((item) => item.toLocaleLowerCase("fa-IR") === skill.toLocaleLowerCase("fa-IR"))) {
      setError("requiredSkills", { message: "این مهارت قبلاً اضافه شده است." });
      return;
    }
    setValue("requiredSkills", [...skills, skill], { shouldDirty: true, shouldValidate: true });
    clearErrors("requiredSkills");
    setSkillInput("");
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "،") {
      event.preventDefault();
      addSkill();
    }
  }

  function runEditorCommand(command: "bold" | "insertUnorderedList" | "insertOrderedList") {
    editorRef.current?.focus();
    document.execCommand(command);
    setValue("description", editorRef.current?.innerHTML ?? "", { shouldDirty: true, shouldValidate: true });
  }

  function submitForm(_values: JobPostFormValues, event?: BaseSyntheticEvent) {
    if (!event) return;
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit(submitForm)} className="grid gap-7" noValidate>
      {serverError ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{serverError}</p> : null}

      <FormField id="job-title" label="عنوان شغلی" required error={errors.title?.message}>
        <Input {...register("title")} maxLength={200} autoComplete="off" />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="workplace-type" label="نوع حضور" required error={errors.workplaceType?.message}>
          <Select {...register("workplaceType")}>
            <option value="">انتخاب کنید</option>
            {workplaceTypes.map((value) => <option key={value} value={value}>{workplaceTypeLabels[value]}</option>)}
          </Select>
        </FormField>
        <FormField id="employment-type" label="نوع همکاری" required error={errors.employmentType?.message}>
          <Select {...register("employmentType")}>
            <option value="">انتخاب کنید</option>
            {employmentTypes.map((value) => <option key={value} value={value}>{employmentTypeLabels[value]}</option>)}
          </Select>
        </FormField>
        <FormField id="job-location" label="شهر" required error={errors.location?.message}>
          <Input {...register("location")} maxLength={160} autoComplete="off" />
        </FormField>
        <FormField id="seniority-level" label="سطح ارشدیت" required error={errors.seniorityLevel?.message}>
          <Select {...register("seniorityLevel")}>
            <option value="">انتخاب کنید</option>
            {seniorityLevels.map((value) => <option key={value} value={value}>{seniorityLevelLabels[value]}</option>)}
          </Select>
        </FormField>
      </div>

      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">بازه حقوق</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            value="true"
            {...register("salaryNegotiable", {
              onChange: (event) => {
                if (event.target.checked) {
                  setValue("salaryMin", null, { shouldValidate: true });
                  setValue("salaryMax", null, { shouldValidate: true });
                }
              },
            })}
            className="size-4 accent-action"
          />
          حقوق توافقی
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="salary-min" label="حداقل حقوق" required={!salaryNegotiable} error={errors.salaryMin?.message}>
            <Input type="number" inputMode="numeric" min={0} disabled={salaryNegotiable} {...register("salaryMin", { setValueAs: (value) => value === "" ? null : Number(value) })} />
          </FormField>
          <FormField id="salary-max" label="حداکثر حقوق" required={!salaryNegotiable} error={errors.salaryMax?.message}>
            <Input type="number" inputMode="numeric" min={0} disabled={salaryNegotiable} {...register("salaryMax", { setValueAs: (value) => value === "" ? null : Number(value) })} />
          </FormField>
        </div>
        <p className="text-helper">مبالغ به تومان ثبت می‌شوند.</p>
      </fieldset>

      <div className="grid gap-2">
        <label htmlFor="skill-input" className="text-label">مهارت‌های کلیدی <span className="text-danger">*</span></label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="skill-input" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={handleSkillKeyDown} maxLength={50} aria-describedby="skills-hint skills-error" placeholder="با Enter یا ویرگول اضافه کنید" />
          <Button type="button" variant="secondary" onClick={addSkill} disabled={skills.length >= JOB_SKILLS_MAX}>افزودن</Button>
        </div>
        <p id="skills-hint" className="text-helper">حداقل ۱ و حداکثر ۱۰ مهارت</p>
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="مهارت‌های انتخاب‌شده">
            {skills.map((skill, index) => (
              <span key={`${skill}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5 text-sm ring-1 ring-inset ring-ui-border">
                {skill}
                <button type="button" onClick={() => setValue("requiredSkills", skills.filter((_, itemIndex) => itemIndex !== index), { shouldDirty: true, shouldValidate: true })} className="rounded text-text-muted outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-focus" aria-label={`حذف مهارت ${skill}`}>×</button>
                <input type="hidden" name="requiredSkills" value={skill} />
              </span>
            ))}
          </div>
        ) : null}
        {errors.requiredSkills?.message ? <p id="skills-error" className="text-helper text-danger">{errors.requiredSkills.message}</p> : null}
      </div>

      <div className="grid gap-2">
        <label id="description-label" className="text-label">توضیحات شغل <span className="text-danger">*</span></label>
        <div className="overflow-hidden rounded-md border bg-surface focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/20">
          <div className="flex flex-wrap gap-1 border-b bg-surface-elevated p-2" role="toolbar" aria-label="قالب‌بندی توضیحات">
            <button type="button" onClick={() => runEditorCommand("bold")} className="rounded px-3 py-1.5 text-sm font-bold hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus">ضخیم</button>
            <button type="button" onClick={() => runEditorCommand("insertUnorderedList")} className="rounded px-3 py-1.5 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus">فهرست نشانه‌دار</button>
            <button type="button" onClick={() => runEditorCommand("insertOrderedList")} className="rounded px-3 py-1.5 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus">فهرست شماره‌دار</button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-labelledby="description-label"
            aria-multiline="true"
            aria-invalid={Boolean(errors.description) || undefined}
            className="min-h-52 px-4 py-3 text-sm leading-7 outline-none [&_ol]:list-decimal [&_ol]:pe-6 [&_ul]:list-disc [&_ul]:pe-6"
            dangerouslySetInnerHTML={{ __html: initialValues?.description ?? "" }}
            onInput={(event) => setValue("description", event.currentTarget.innerHTML, { shouldDirty: true, shouldValidate: true })}
            suppressContentEditableWarning
          />
        </div>
        <input type="hidden" name="description" value={description} readOnly />
        <p className="text-helper">مسئولیت‌ها و الزامات موقعیت را با متن، فهرست و عبارت‌های ضخیم بنویسید.</p>
        {errors.description?.message ? <p className="text-helper text-danger">{errors.description.message}</p> : null}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={discardDraft} disabled={isPending}>حذف پیش‌نویس محلی</Button>
        <Button type="submit" loading={isPending} className="w-full sm:w-auto">{submitLabel}</Button>
      </div>
    </form>
  );
}
