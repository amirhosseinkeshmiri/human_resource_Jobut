import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/admin-auth/session";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "ورود مدیریت" };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");

  return (
    <main className="grid min-h-screen place-items-center bg-surface-elevated py-10">
      <Container>
        <Card className="mx-auto max-w-md border-t-4 border-t-action">
          <BrandLogo className="mx-auto mb-6 w-24" />
          <div className="mb-7">
            <p className="text-meta">JOBUT Admin</p>
            <h1 className="text-section-title mt-2">ورود به مدیریت</h1>
            <p className="text-secondary mt-2">ورود فقط برای حساب‌های مدیریتی از پیش تعریف‌شده امکان‌پذیر است.</p>
          </div>
          <AdminLoginForm />
          <div className="mt-7 border-t pt-5 text-center">
            <Link href="/" className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">بازگشت به سایت</Link>
          </div>
        </Card>
      </Container>
    </main>
  );
}
