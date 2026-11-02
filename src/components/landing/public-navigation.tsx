"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonClassNames } from "@/components/ui/button";
import { classNames } from "@/lib/class-names";
import { PUBLIC_JOBS_LABEL, PUBLIC_JOBS_ROUTE } from "@/jobs/public-copy";
import { logoutBrowserAccount } from "@/auth/browser-session-actions";

interface NavigationItem {
  label: string;
  href: string;
  activePath?: string;
}

const navigationItems: readonly NavigationItem[] = [
  { label: "خانه", href: "/", activePath: "/" },
  { label: PUBLIC_JOBS_LABEL, href: PUBLIC_JOBS_ROUTE, activePath: PUBLIC_JOBS_ROUTE },
  { label: "خدمات ما", href: "/#services" },
  { label: "درباره ما", href: "/#about" },
];

function isItemActive(pathname: string, activePath?: string) {
  if (!activePath) return false;
  if (activePath === "/") return pathname === "/";
  return pathname === activePath || pathname.startsWith(`${activePath}/`);
}

function NavigationLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return navigationItems.map((item) => {
    const active = isItemActive(pathname, item.activePath);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={classNames(
          "relative flex min-h-11 items-center rounded-sm px-1 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
          active ? "text-action after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : "text-text-secondary hover:text-action",
        )}
      >
        {item.label}
      </Link>
    );
  });
}

interface PublicNavigationProps {
  identity: { role: "candidate" | "employer" | "conflict"; displayName: string } | null;
}

function AccountActions({ identity, mobile = false, onNavigate }: PublicNavigationProps & { mobile?: boolean; onNavigate?: () => void }) {
  if (!identity) return <>
    <Link href="/login/candidate" onClick={onNavigate} className={buttonClassNames({ variant: mobile ? "secondary" : "ghost", size: mobile ? undefined : "small", className: mobile ? "w-full" : undefined })}>ورود کارجو</Link>
    <Link href="/login/employer" onClick={onNavigate} className={buttonClassNames({ size: mobile ? undefined : "small", className: mobile ? "w-full" : "px-4" })}>ورود کارفرما</Link>
  </>;

  const dashboard = identity.role === "candidate" ? "/candidate" : identity.role === "employer" ? "/employer" : null;
  return <>
    {dashboard ? <Link href={dashboard} onClick={onNavigate} className={buttonClassNames({ variant: "secondary", size: mobile ? undefined : "small", className: mobile ? "w-full" : undefined })}>{identity.displayName}</Link> : <span className="px-2 text-sm font-semibold text-danger">{identity.displayName}</span>}
    <form action={logoutBrowserAccount} className={mobile ? "w-full" : undefined}><button type="submit" className={buttonClassNames({ variant: "ghost", size: mobile ? undefined : "small", className: mobile ? "w-full" : undefined })}>خروج</button></form>
  </>;
}

export function PublicNavigation({ identity }: PublicNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end xl:gap-8">
      <nav aria-label="ناوبری اصلی" className="hidden items-center gap-6 xl:flex">
        <NavigationLinks pathname={pathname} />
      </nav>

      <div className="ms-auto hidden shrink-0 items-center gap-2 xl:flex">
        <AccountActions identity={identity} />
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "بستن منوی اصلی" : "باز کردن منوی اصلی"}
        aria-expanded={open}
        aria-controls="public-mobile-navigation"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-11 items-center justify-center rounded-md border border-ui-border bg-surface text-action outline-none transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 xl:hidden"
      >
        {open ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open ? (
        <div id="public-mobile-navigation" className="absolute inset-x-[var(--page-padding)] top-[calc(100%+0.5rem)] rounded-lg border border-ui-border bg-surface p-3 shadow-[0_12px_32px_rgb(20_33_145/0.12)] xl:hidden">
          <nav aria-label="ناوبری اصلی موبایل" className="grid gap-0.5">
            <NavigationLinks pathname={pathname} onNavigate={closeMenu} />
          </nav>
          <div className="mt-3 grid gap-2 border-t border-ui-border pt-3 sm:grid-cols-2">
            <AccountActions identity={identity} mobile onNavigate={closeMenu} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
