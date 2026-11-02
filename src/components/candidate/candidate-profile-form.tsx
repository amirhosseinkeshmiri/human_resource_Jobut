"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCandidateBasicProfile, type CandidateProfileActionState } from "@/candidate-profile/actions";
import { Button, Card, FormField, Input, Textarea, buttonClassNames } from "@/components/ui";
import type { CandidateBasicProfileInput } from "@/resume/validation";

const idleState: CandidateProfileActionState = { status: "idle" };

export function CandidateProfileForm({ initialValues }: { initialValues: CandidateBasicProfileInput }) {
  const [state, action, pending] = useActionState(saveCandidateBasicProfile, idleState);
  const values = state.values ?? initialValues;
  return <form action={action} className="grid gap-6" noValidate>
    {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm font-semibold ${state.status === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-success/5 text-success"}`}>{state.message}</p> : null}
    <Card className="shadow-none"><h2 className="text-section-title">اطلاعات پایه</h2><p className="text-helper mt-2">این اطلاعات با بخش اطلاعات پایه رزومه مشترک است و تغییرات در هر دو محل نمایش داده می‌شود.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <FormField id="profile-first-name" label="نام" required error={state.fieldErrors?.firstName}><Input name="firstName" defaultValue={values.firstName} maxLength={100} autoComplete="given-name" /></FormField>
      <FormField id="profile-last-name" label="نام خانوادگی" required error={state.fieldErrors?.lastName}><Input name="lastName" defaultValue={values.lastName} maxLength={120} autoComplete="family-name" /></FormField>
      <FormField id="profile-city" label="شهر" required error={state.fieldErrors?.city}><Input name="city" defaultValue={values.city} maxLength={160} autoComplete="address-level2" /></FormField>
      <FormField id="profile-professional-title" label="عنوان حرفه‌ای" required error={state.fieldErrors?.professionalTitle}><Input name="professionalTitle" defaultValue={values.professionalTitle} maxLength={160} /></FormField>
    </div></Card>
    <Card className="shadow-none"><h2 className="text-section-title">معرفی حرفه‌ای</h2><div className="mt-5"><FormField id="profile-summary" label="خلاصه حرفه‌ای" required error={state.fieldErrors?.professionalSummary}><Textarea name="professionalSummary" defaultValue={values.professionalSummary} rows={6} maxLength={2000} /></FormField></div></Card>
    <Card className="shadow-none"><h2 className="text-section-title">لینک‌های حرفه‌ای</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <FormField id="profile-linkedin" label="لینکدین" error={state.fieldErrors?.linkedinUrl}><Input name="linkedinUrl" type="url" dir="ltr" defaultValue={values.linkedinUrl ?? ""} maxLength={2000} /></FormField>
      <FormField id="profile-portfolio" label="نمونه‌کار" error={state.fieldErrors?.portfolioUrl}><Input name="portfolioUrl" type="url" dir="ltr" defaultValue={values.portfolioUrl ?? ""} maxLength={2000} /></FormField>
    </div></Card>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/candidate/resume" className={buttonClassNames({ variant: "secondary" })}>مشاهده رزومه</Link><Button type="submit" loading={pending}>ذخیره پروفایل</Button></div>
  </form>;
}
