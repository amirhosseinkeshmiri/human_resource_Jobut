import type { TextareaHTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid = false, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={classNames(
        "w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-start text-sm leading-7 text-text-primary outline-none transition-colors focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted",
        invalid && "border-danger focus-visible:border-danger focus-visible:ring-danger/15",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
