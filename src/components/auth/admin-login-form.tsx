"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestAdminVerificationCode,
  verifyAdminCode,
  type AdminRequestCodeState,
  type AdminVerifyCodeState,
} from "@/admin-auth/actions";
import { Button, FormField, Input } from "@/components/ui";

const initialRequestState: AdminRequestCodeState = { status: "idle" };
const initialVerifyState: AdminVerifyCodeState = { status: "idle" };

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} className="w-full">{pending ? "کمی صبر کنید…" : children}</Button>;
}

export function AdminLoginForm() {
  const [requestState, requestAction] = useActionState(requestAdminVerificationCode, initialRequestState);
  const [verifyState, verifyAction] = useActionState(verifyAdminCode, initialVerifyState);

  if (requestState.status === "challenge" && requestState.challengeId) {
    return (
      <form action={verifyAction} className="grid gap-[var(--form-spacing)]">
        <input type="hidden" name="challengeId" value={requestState.challengeId} />
        <div>
          <p className="text-label">کد تأیید مدیریت</p>
          <p className="text-helper mt-1" dir="ltr">{requestState.identifier}</p>
        </div>
        {requestState.developmentCode ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">فقط محیط توسعه — کد ورود: <bdi>{requestState.developmentCode}</bdi></div>
        ) : null}
        <FormField id="admin-code" label="کد شش‌رقمی" error={verifyState.status === "error" ? verifyState.message : undefined}>
          <Input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" className="text-center text-lg tracking-[0.35em]" invalid={verifyState.status === "error"} required />
        </FormField>
        <SubmitButton>ورود به مدیریت</SubmitButton>
        <a href="/admin/login" className="text-center text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">ویرایش شناسه ورود</a>
      </form>
    );
  }

  return (
    <form action={requestAction} className="grid gap-[var(--form-spacing)]">
      <FormField id="admin-identifier" label="ایمیل یا شماره موبایل مدیر" error={requestState.status === "error" ? requestState.message : undefined}>
        <Input name="identifier" type="text" inputMode="email" autoComplete="username" dir="auto" invalid={requestState.status === "error"} required />
      </FormField>
      <SubmitButton>دریافت کد تأیید</SubmitButton>
    </form>
  );
}
