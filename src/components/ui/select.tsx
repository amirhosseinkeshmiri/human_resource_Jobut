import type { SelectHTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid = false, children, ...props }: SelectProps) {
  return (
    <select
      className={classNames(
        "min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-start text-sm text-text-primary outline-none transition-colors focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted",
        invalid && "border-danger focus-visible:border-danger focus-visible:ring-danger/15",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}
