import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LoginMenu } from "./login-menu";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-ui-border bg-surface">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-text-primary outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30"
        >
          جاب‌اوت
        </Link>
        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-6 sm:flex">
          <Link
            href="#jobs"
            className="text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            شغل‌ها
          </Link>
          <Link
            href="#why-jobut"
            className="text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            چرا جاب‌اوت
          </Link>
        </nav>
        <LoginMenu />
      </Container>
    </header>
  );
}
