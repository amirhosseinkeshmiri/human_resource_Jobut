"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import type { CandidateDataRequestType } from "@/candidate-data-requests/policy";

function SubmitButton({ label, destructive, disabled }: { label: string; destructive?: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={destructive ? "destructive" : "primary"} loading={pending} disabled={disabled} className="w-full sm:w-auto">
    {pending ? "در حال ثبت…" : label}
  </Button>;
}

export function DataRequestForm({
  requestType,
  label,
  destructive,
  disabled,
  disabledLabel,
  action,
}: {
  requestType: CandidateDataRequestType;
  label: string;
  destructive?: boolean;
  disabled: boolean;
  disabledLabel?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return <form action={action}>
    <input type="hidden" name="requestType" value={requestType} />
    <SubmitButton label={disabled ? (disabledLabel ?? "درخواست فعال دارید") : label} destructive={destructive} disabled={disabled} />
  </form>;
}
