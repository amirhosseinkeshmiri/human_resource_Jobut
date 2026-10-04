import Link from "next/link";
import { buttonClassNames } from "@/components/ui/button";

export function LoginMenu() {
  return (
    <details className="group relative">
      <summary
        className={buttonClassNames({
          variant: "secondary",
          size: "small",
          className: "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
        })}
      >
        ورود
        <span
          aria-hidden="true"
          className="text-xs text-text-muted transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="absolute inset-inline-end-0 z-20 mt-2 min-w-40 rounded-md border bg-surface p-1.5 shadow-[0_8px_24px_rgb(23_33_29/0.1)]">
        <Link
          href="/login/employer"
          className="block rounded px-3 py-2 text-sm font-medium text-text-primary outline-none hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-focus/30"
        >
          کارفرما
        </Link>
        <Link
          href="/login/candidate"
          className="block rounded px-3 py-2 text-sm font-medium text-text-primary outline-none hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-focus/30"
        >
          کارجو
        </Link>
      </div>
    </details>
  );
}
