import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployer } from "@/auth/session";
import { EmployerLoginForm } from "@/components/auth/employer-login-form";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "ورود کارفرما",
};

export default async function EmployerLoginPage() {
  if (await getCurrentEmployer()) redirect("/employer");

  return (
    <main className="grid min-h-screen place-items-center py-10">
      <Container>
        <Card className="mx-auto max-w-md">
          <div className="mb-7">
            <p className="text-meta">ورود امن و بدون رمز عبور</p>
            <h1 className="text-section-title mt-2">ورود کارفرما</h1>
            <p className="text-secondary mt-2">
              برای دریافت کد ورود، ایمیل یا شماره موبایل خود را وارد کنید.
            </p>
          </div>
          <EmployerLoginForm />
          <div className="mt-7 border-t pt-5 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              بازگشت به صفحه اصلی
            </Link>
          </div>
        </Card>
      </Container>
    </main>
  );
}
