import { Button, Card, Input } from "@/components/ui";
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
}

const checkboxClassName = "size-5 shrink-0 accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

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

export function JobPreferencesForm({ action, preferences, serverError }: JobPreferencesFormProps) {
  const locations = Array.from({ length: 5 }, (_, index) => preferences.preferredLocations[index] ?? "");

  return <form action={action} className="grid gap-4">
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
    <div className="sticky bottom-0 rounded-lg border border-ui-border bg-surface/95 p-3 shadow-sm backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><Button type="submit" className="w-full sm:w-auto">ذخیره ترجیحات</Button></div>
  </form>;
}
