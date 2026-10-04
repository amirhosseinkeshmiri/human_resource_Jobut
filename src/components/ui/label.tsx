import type { LabelHTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={classNames("text-label block text-text-primary", className)}
      {...props}
    />
  );
}
