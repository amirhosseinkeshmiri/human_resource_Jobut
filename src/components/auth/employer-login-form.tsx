"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestEmployerVerificationCode,
  verifyEmployerCode,
  type RequestCodeState,
  type VerifyCodeState,
} from "@/auth/actions";
import { Button, FormField, Input } from "@/components/ui";

const initialRequestState: RequestCodeState = { status: "idle" };
const initialVerifyState: VerifyCodeState = { status: "idle" };

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} className="w-full">
      {pending ? "کمی صبر کنید…" : children}
    </Button>
  );
}

export function EmployerLoginForm() {
  const [requestState, requestAction] = useActionState(
    requestEmployerVerificationCode,
    initialRequestState,
  );
  const [verifyState, verifyAction] = useActionState(verifyEmployerCode, initialVerifyState);

  if (requestState.status === "challenge" && requestState.challengeId) {
    return (
      <form action={verifyAction} className="grid gap-[var(--form-spacing)]">
        <input type="hidden" name="challengeId" value={requestState.challengeId} />
        <div>
          <p className="text-label">کد ورود را وارد کنید</p>
          <p className="text-helper mt-1" dir="ltr">
            {requestState.identifier}
          </p>
        </div>

        {requestState.developmentCode ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            فقط محیط توسعه — کد ورود: <bdi>{requestState.developmentCode}</bdi>
          </div>
        ) : null}

        <FormField
          id="code"
          label="کد شش‌رقمی"
          error={verifyState.status === "error" ? verifyState.message : undefined}
        >
          <Input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            dir="ltr"
            className="text-center text-lg tracking-[0.35em]"
            invalid={verifyState.status === "error"}
            required
          />
        </FormField>

        <SubmitButton>تأیید و ورود</SubmitButton>
        <a
          href="/login/employer"
          className="text-center text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ویرایش ایمیل یا شماره موبایل
        </a>
      </form>
    );
  }

  return (
    <form action={requestAction} className="grid gap-[var(--form-spacing)]">
      <FormField
        id="identifier"
        label="ایمیل یا شماره موبایل"
        hint="شماره موبایل ایرانی را با ۰۹ یا ۹۸+ وارد کنید."
        error={requestState.status === "error" ? requestState.message : undefined}
      >
        <Input
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="example@company.com یا 09121234567"
          dir="auto"
          invalid={requestState.status === "error"}
          required
        />
      </FormField>
      <SubmitButton>ادامه</SubmitButton>
    </form>
  );
}
