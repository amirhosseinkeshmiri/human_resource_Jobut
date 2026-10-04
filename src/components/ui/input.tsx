import type { InputHTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      className={classNames(
        "min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-start text-sm text-text-primary outline-none transition-colors focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted",
        invalid && "border-danger focus-visible:border-danger focus-visible:ring-danger/15",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
