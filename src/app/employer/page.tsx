import { logoutEmployer } from "@/auth/actions";
import { requireEmployer } from "@/auth/session";
import { Button, Card, Container } from "@/components/ui";
import { getEmployerCompanyOnboarding } from "@/onboarding/company";
import { redirect } from "next/navigation";

export default async function EmployerPage() {
  const employer = await requireEmployer();
  const onboarding = await getEmployerCompanyOnboarding(employer.id);
  if (!onboarding.complete) redirect("/employer/onboarding");

  const identifier = employer.email ?? employer.mobile;

  return (
    <main className="grid min-h-screen place-items-center py-10">
      <Container width="dashboard">
        <Card className="mx-auto max-w-xl">
          <p className="text-meta">محیط کارفرما</p>
          <h1 className="text-section-title mt-2">اطلاعات شرکت تکمیل شده است</h1>
          <p className="text-secondary mt-3">
            حساب <bdi>{identifier}</bdi> احراز شده و پروفایل {onboarding.company?.name} آماده
            است. داشبورد در مرحله بعد ساخته می‌شود.
          </p>
          <form action={logoutEmployer} className="mt-7">
            <Button type="submit" variant="secondary">
              خروج
            </Button>
          </form>
        </Card>
      </Container>
    </main>
  );
}
