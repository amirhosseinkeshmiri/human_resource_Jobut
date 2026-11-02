"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button, Card, Input } from "@/components/ui";
import { clearFormDraft, loadFormDraft, saveFormDraft, type FormDraftOptions } from "@/forms/form-draft";
import {
  employmentTypeLabels,
  employmentTypes,
  seniorityLevelLabels,
  seniorityLevels,
  workplaceTypeLabels,
  workplaceTypes,
} from "@/jobs/validation";
import type { CandidateJobPreferences } from "@/preferences/validation";

interface JobPreferencesFormProps {
  action: (formData: FormData) => Promise<void>;
  preferences: CandidateJobPreferences;
  serverError?: string;
  candidateAccountId: string;
  serverUpdatedAt: number;
  submissionSucceeded: boolean;
}

const checkboxClassName = "size-5 shrink-0 accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const PREFERENCE_DRAFT_FIELDS = [
  "preferredLocations",
  "preferredWorkplaceTypes",
  "preferredEmploymentTypes",
  "preferredSeniorityLevels",
] as const;

function readPreferenceValues(form: HTMLFormElement) {
  const data = new FormData(form);
  return Object.fromEntries(PREFERENCE_DRAFT_FIELDS.map((field) => [field, data.getAll(field).map(String)]));
}

function applyPreferenceValues(form: HTMLFormElement, values: Record<string, unknown>) {
  const locations = Array.isArray(values.preferredLocations)
    ? values.preferredLocations.filter((value): value is string => typeof value === "string").slice(0, 5)
    : [];
  form.querySelectorAll<HTMLInputElement>('input[name="preferredLocations"]').forEach((input, index) => {
    input.value = locations[index] ?? "";
  });
  for (const field of PREFERENCE_DRAFT_FIELDS.slice(1)) {
    const selected = Array.isArray(values[field])
      ? new Set(values[field].filter((value): value is string => typeof value === "string"))
      : new Set<string>();
    form.querySelectorAll<HTMLInputElement>(`input[name="${field}"]`).forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }
}

function CheckboxGroup<T extends string>({
  name,
  values,
  labels,
  selected,
}: {
  name: string;
  values: readonly T[];
  labels: Record<T, string>;
  selected: readonly T[];
}) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">{values.map((value) => {
    const id = `${name}-${value}`;
    return <label key={value} htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-ui-border px-4 py-3 text-sm font-medium hover:bg-surface-elevated"><input id={id} name={name} value={value} type="checkbox" defaultChecked={selected.includes(value)} className={checkboxClassName} />{labels[value]}</label>;
  })}</div>;
}

export function JobPreferencesForm({
  action,
  preferences,
  serverError,
  candidateAccountId,
  serverUpdatedAt,
  submissionSucceeded,
}: JobPreferencesFormProps) {
  const locations = Array.from({ length: 5 }, (_, index) => preferences.preferredLocations[index] ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const userEditedRef = useRef(false);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftOptions = useMemo<FormDraftOptions>(() => ({
    scope: { accountId: candidateAccountId, formId: "candidate-job-preferences", entityId: "self" },
    allowedFields: PREFERENCE_DRAFT_FIELDS,
  }), [candidateAccountId]);
  const serverValues = useMemo(() => ({
    preferredLocations: locations,
    preferredWorkplaceTypes: preferences.preferredWorkplaceTypes,
    preferredEmploymentTypes: preferences.preferredEmploymentTypes,
    preferredSeniorityLevels: preferences.preferredSeniorityLevels,
  }), [locations, preferences]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (submissionSucceeded) {
      clearFormDraft(window.localStorage, draftOptions.scope);
      return;
    }
    if (userEditedRef.current) return;
    const draft = loadFormDraft<Record<string, unknown>>(window.localStorage, draftOptions, serverUpdatedAt);
    if (draft && !userEditedRef.current) applyPreferenceValues(form, draft.values);
  }, [draftOptions, serverUpdatedAt, submissionSucceeded]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const persist = () => {
      userEditedRef.current = true;
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = setTimeout(() => {
        saveFormDraft(window.localStorage, draftOptions, readPreferenceValues(form));
        pendingSaveRef.current = undefined;
      }, 350);
    };
    form.addEventListener("input", persist);
    form.addEventListener("change", persist);
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      form.removeEventListener("input", persist);
      form.removeEventListener("change", persist);
    };
  }, [draftOptions]);

  function discardDraft() {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = undefined;
    }
    clearFormDraft(window.localStorage, draftOptions.scope);
    const form = formRef.current;
    if (form) applyPreferenceValues(form, serverValues);
  }

  return <form ref={formRef} action={action} className="grid gap-4">
    {serverError ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger">{serverError}</p> : null}
    <Card className="shadow-none">
      <fieldset>
        <legend className="text-card-title">محل‌های کاری موردنظر</legend>
        <p className="text-secondary mt-2 text-sm">حداکثر پنج شهر یا محل را وارد کنید. خالی گذاشتن این بخش یعنی محدودیتی ندارید.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {locations.map((location, index) => <div key={index}><label htmlFor={`preferred-location-${index}`} className="mb-1.5 block text-sm font-medium">محل {index + 1}</label><Input id={`preferred-location-${index}`} name="preferredLocations" defaultValue={location} maxLength={160} autoComplete="address-level2" /></div>)}
        </div>
      </fieldset>
    </Card>
    <Card className="shadow-none"><fieldset><legend className="text-card-title">نحوه حضور</legend><p className="text-secondary mt-2 text-sm">یک یا چند گزینه را انتخاب کنید.</p><CheckboxGroup name="preferredWorkplaceTypes" values={workplaceTypes} labels={workplaceTypeLabels} selected={preferences.preferredWorkplaceTypes} /></fieldset></Card>
    <Card className="shadow-none"><fieldset><legend className="text-card-title">نوع همکاری</legend><p className="text-secondary mt-2 text-sm">همه گزینه‌ها اختیاری هستند.</p><CheckboxGroup name="preferredEmploymentTypes" values={employmentTypes} labels={employmentTypeLabels} selected={preferences.preferredEmploymentTypes} /></fieldset></Card>
    <Card className="shadow-none"><fieldset><legend className="text-card-title">سطح شغلی</legend><p className="text-secondary mt-2 text-sm">سطح‌های موردنظر خود را مشخص کنید.</p><CheckboxGroup name="preferredSeniorityLevels" values={seniorityLevels} labels={seniorityLevelLabels} selected={preferences.preferredSeniorityLevels} /></fieldset></Card>
    <div className="sticky bottom-0 flex flex-col-reverse gap-3 rounded-lg border border-ui-border bg-surface/95 p-3 shadow-sm backdrop-blur sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><Button type="button" variant="ghost" onClick={discardDraft}>حذف پیش‌نویس محلی</Button><Button type="submit" className="w-full sm:w-auto">ذخیره ترجیحات</Button></div>
  </form>;
}
