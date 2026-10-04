import type { HTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        "rounded-lg border bg-surface p-[var(--card-padding)] text-text-primary shadow-[0_1px_2px_rgb(23_33_29/0.04)]",
        className,
      )}
      {...props}
    />
  );
}
