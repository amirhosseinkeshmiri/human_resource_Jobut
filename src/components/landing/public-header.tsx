import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "@/components/ui/container";
import { PublicNavigation } from "./public-navigation";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ui-border bg-surface/95 shadow-[0_1px_0_rgb(20_33_145/0.03)] backdrop-blur-sm">
      <Container className="relative flex h-[4.5rem] items-center gap-5">
        <Link
          href="/"
          aria-label="صفحه اصلی شبکه استخدامی متخصصین آکادمیک"
          className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <BrandLogo priority className="w-[4.5rem] sm:w-20" />
        </Link>
        <PublicNavigation />
      </Container>
    </header>
  );
}
