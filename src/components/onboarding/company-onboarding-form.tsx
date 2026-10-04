"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveCompanyOnboarding,
  type OnboardingActionState,
} from "@/onboarding/actions";
import { Button, FormField, Input, Label, Select, Textarea } from "@/components/ui";

interface Option {
  id: string;
  name: string;
}

interface ExistingCompanyValues {
  name: string;
  industryId: string;
  address: string;
  foundingYear: number | null;
  hasLogo: boolean;
  imageCount: number;
  benefitIds: string[];
}

interface CompanyOnboardingFormProps {
  industries: Option[];
  benefits: Option[];
  existing: ExistingCompanyValues | null;
  maximumFoundingYear: number;
}

const initialState: OnboardingActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="large" loading={pending} className="w-full sm:w-auto">
      {pending ? "در حال ثبت…" : "ثبت و ادامه"}
    </Button>
  );
}

export function CompanyOnboardingForm({
  industries,
  benefits,
  existing,
  maximumFoundingYear,
}: CompanyOnboardingFormProps) {
  const [state, action] = useActionState(saveCompanyOnboarding, initialState);

  return (
    <form action={action} className="grid gap-6" encType="multipart/form-data">
      {state.status === "error" ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {state.message}
        </div>
      ) : null}

      <section aria-labelledby="company-info-title" className="grid gap-5">
        <div>
          <h2 id="company-info-title" className="text-card-title">اطلاعات شرکت</h2>
          <p className="text-helper mt-1">اطلاعات پایه‌ای که برای ایجاد پروفایل شرکت لازم است.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="name" label="نام شرکت" required>
            <Input name="name" defaultValue={existing?.name} maxLength={200} required />
          </FormField>
          <FormField id="industryId" label="حوزه فعالیت" required>
            <Select name="industryId" defaultValue={existing?.industryId ?? ""} required>
              <option value="" disabled>حوزه فعالیت را انتخاب کنید</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>{industry.name}</option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="address" label="نشانی شرکت" required>
          <Textarea name="address" defaultValue={existing?.address} maxLength={1000} required />
        </FormField>
        <FormField id="foundingYear" label="سال تأسیس (شمسی)" required>
          <Input
            name="foundingYear"
            type="number"
            inputMode="numeric"
            min={1200}
            max={maximumFoundingYear}
            defaultValue={existing?.foundingYear ?? ""}
            className="sm:max-w-48"
            required
          />
        </FormField>
      </section>

      <hr className="border-ui-border" />

      <section aria-labelledby="benefits-title">
        <h2 id="benefits-title" className="text-card-title">مزایا و امکانات</h2>
        <p className="text-helper mt-1">در صورت تمایل، مزایای شرکت را انتخاب کنید.</p>
        {benefits.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <Label key={benefit.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal hover:bg-surface-elevated">
                <input
                  type="checkbox"
                  name="benefitIds"
                  value={benefit.id}
                  defaultChecked={existing?.benefitIds.includes(benefit.id)}
                  className="size-4 accent-action"
                />
                {benefit.name}
              </Label>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            داده مرجع مزایا هنوز بارگذاری نشده است.
          </p>
        )}
      </section>

      <hr className="border-ui-border" />

      <section aria-labelledby="logo-title" className="grid gap-4">
        <div>
          <h2 id="logo-title" className="text-card-title">لوگوی شرکت</h2>
          <p className="text-helper mt-1">تصویر PNG یا JPEG مربع، حداکثر ۵ مگابایت.</p>
        </div>
        {existing?.hasLogo ? <p className="text-helper text-success">لوگو قبلاً ثبت شده است؛ انتخاب فایل جدید اختیاری است.</p> : null}
        <FormField id="logo" label="فایل لوگو">
          <Input name="logo" type="file" accept="image/png,image/jpeg" />
        </FormField>
      </section>

      <hr className="border-ui-border" />

      <section aria-labelledby="gallery-title" className="grid gap-4">
        <div>
          <h2 id="gallery-title" className="text-card-title">تصاویر شرکت</h2>
          <p className="text-helper mt-1">در صورت تمایل، تا شش تصویر PNG یا JPEG انتخاب کنید؛ ترتیب انتخاب حفظ می‌شود.</p>
        </div>
        {existing && existing.imageCount > 0 ? (
          <p className="text-helper text-success">{existing.imageCount} تصویر قبلاً ثبت شده است؛ انتخاب جدید جایگزین آن‌ها می‌شود.</p>
        ) : null}
        <FormField id="gallery" label="فایل‌های گالری">
          <Input name="gallery" type="file" accept="image/png,image/jpeg" multiple />
        </FormField>
        <p className="text-helper">ذخیره فایل فعلاً فقط در محیط توسعه فعال است و برای استقرار اصلی به ارائه‌دهنده ذخیره‌سازی نیاز دارد.</p>
      </section>

      <div className="border-t pt-6">
        <SubmitButton />
      </div>
    </form>
  );
}
