"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

function ApplicationSubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} className="w-full">
    {pending ? "در حال ارسال درخواست…" : "ارسال رزومه"}
  </Button>;
}

export function ApplicationSubmitForm({
  jobPostId,
  action,
}: {
  jobPostId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return <form action={action} className="mt-4">
    <input type="hidden" name="jobPostId" value={jobPostId} />
    <ApplicationSubmitButton />
  </form>;
}
