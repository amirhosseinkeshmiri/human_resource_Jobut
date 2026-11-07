"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui";

export function PendingSubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" loading={pending}>
      {pending ? "در حال ذخیره…" : children}
    </Button>
  );
}
