import Image from "next/image";
import type { ReactNode } from "react";
import { logoutEmployer } from "@/auth/actions";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button, Container } from "@/components/ui";
import { getEmployerDashboardContext } from "@/dashboard/context";

interface EmployerDashboardLayoutProps {
  children: ReactNode;
}

export default async function EmployerDashboardLayout({ children }: EmployerDashboardLayoutProps) {
  const { company } = await getEmployerDashboardContext();
  const developmentLogo =
    process.env.NODE_ENV !== "production" && company.logoUrl?.startsWith("/dev-uploads/")
      ? company.logoUrl
      : null;

  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      {developmentLogo ? (
        <Image
          src={developmentLogo}
          alt={`لوگوی ${company.name}`}
          width={40}
          height={40}
          unoptimized
          className="size-10 shrink-0 rounded-md border object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-meta">محیط کارفرما</p>
        <p className="truncate text-sm font-bold text-text-primary">{company.name}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-e border-ui-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b p-5">{identity}</div>
        <DashboardNav variant="desktop" />
        <form action={logoutEmployer} className="mt-auto border-t p-4">
          <Button type="submit" variant="ghost" className="w-full justify-start">
            خروج
          </Button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-ui-border bg-surface lg:hidden">
          <Container width="dashboard" className="flex min-h-16 items-center justify-between gap-3">
            {identity}
            <form action={logoutEmployer}>
              <Button type="submit" variant="ghost" size="small">
                خروج
              </Button>
            </form>
          </Container>
          <DashboardNav variant="mobile" />
        </header>

        <main>
          <Container width="dashboard" className="py-8 sm:py-10">
            {children}
          </Container>
        </main>
      </div>
    </div>
  );
}
