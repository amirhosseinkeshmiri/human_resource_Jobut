import { Container } from "@/components/ui/container";

export function PublicFooter() {
  return (
    <footer className="border-t border-ui-border bg-page">
      <Container className="flex flex-col gap-2 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-start">
        <p className="text-label">جاب‌اوت</p>
        <p className="text-meta">پلتفرم استخدام و کاریابی</p>
      </Container>
    </footer>
  );
}
