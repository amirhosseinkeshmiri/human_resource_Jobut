import { logoutEmployer } from "@/auth/actions";
import { requireEmployer } from "@/auth/session";
import { Button, Card, Container } from "@/components/ui";

export default async function EmployerPage() {
  const employer = await requireEmployer();
  const identifier = employer.email ?? employer.mobile;

  return (
    <main className="grid min-h-screen place-items-center py-10">
      <Container width="dashboard">
        <Card className="mx-auto max-w-xl">
          <p className="text-meta">محیط کارفرما</p>
          <h1 className="text-section-title mt-2">ورود با موفقیت انجام شد</h1>
          <p className="text-secondary mt-3">
            حساب <bdi>{identifier}</bdi> احراز شده است. داشبورد در مرحله بعد ساخته می‌شود.
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
