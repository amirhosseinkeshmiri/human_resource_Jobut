import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LoginMenu } from "./login-menu";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-ui-border bg-surface/95 backdrop-blur-sm">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-text-primary outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30"
        >
          جاب یوتی
        </Link>
        <nav aria-label="ناوبری اصلی" className="order-3 flex w-full items-center gap-5 overflow-x-auto py-1 lg:order-none lg:w-auto">
          {[
            ["شغل‌ها", "/jobs"],
            ["خدمات ما", "/#services"],
            ["چرا جاب یوتی؟", "/#why-jobut"],
            ["درباره ما", "/#about"],
            ["تعرفه‌ها", "/#pricing"],
            ["ارتباط با ما", "/#contact"],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="shrink-0 text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">{label}</Link>
          ))}
        </nav>
        <LoginMenu />
      </Container>
    </header>
  );
}
