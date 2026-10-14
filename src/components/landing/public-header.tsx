import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "@/components/ui/container";
import { LoginMenu } from "./login-menu";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-ui-border bg-surface/95 backdrop-blur-sm">
      <Container className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <Link
          href="/"
          aria-label="صفحه اصلی شبکه استخدامی متخصصین آکادمیک"
          className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus/30"
        >
          <BrandLogo priority className="w-20 sm:w-24" />
        </Link>
        <nav aria-label="ناوبری اصلی" className="order-3 flex w-full items-center gap-5 overflow-x-auto py-1 2xl:order-none 2xl:w-auto">
          {[
            ["آگهی‌ها", "/jobs"],
            ["خدمات ما", "/#services"],
            ["چرا شبکه استخدامی متخصصین آکادمیک؟", "/#why-jobut"],
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
