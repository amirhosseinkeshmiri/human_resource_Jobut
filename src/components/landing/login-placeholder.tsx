import Link from "next/link";
import { Card, Container, buttonClassNames } from "@/components/ui";

interface LoginPlaceholderProps {
  audience: "کارفرما" | "کارجو";
}

export function LoginPlaceholder({ audience }: LoginPlaceholderProps) {
  return (
    <main className="grid min-h-screen place-items-center py-10">
      <Container>
        <Card className="mx-auto max-w-lg text-center">
          <p className="text-meta">مسیر آینده</p>
          <h1 className="text-section-title mt-2">ورود {audience}</h1>
          <p className="text-secondary mt-3">
            این مسیر در مرحله بعدی توسعه فعال می‌شود و هنوز فرم یا فرایند ورود ندارد.
          </p>
          <Link
            href="/"
            className={buttonClassNames({ variant: "secondary", className: "mt-7" })}
          >
            بازگشت به صفحه اصلی
          </Link>
        </Card>
      </Container>
    </main>
  );
}
