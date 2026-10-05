"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { classNames } from "@/lib/class-names";

const items = [
  { href: "/employer", label: "خانه", exact: true },
  { href: "/employer/packages", label: "بسته‌های فعال" },
  { href: "/employer/jobs", label: "مدیریت آگهی‌ها" },
];

interface DashboardNavProps {
  variant: "desktop" | "mobile";
}

export function DashboardNav({ variant }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری محیط کارفرما"
      className={classNames(
        variant === "desktop" ? "grid gap-1 p-3" : "grid grid-cols-3 border-t px-2",
      )}
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={classNames(
              "rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus/30",
              variant === "desktop" ? "px-3 py-2.5" : "px-1 py-3 text-center text-xs sm:text-sm",
              active
                ? "bg-action/10 text-action"
                : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
