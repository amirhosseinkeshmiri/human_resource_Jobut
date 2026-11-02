import type { Metadata } from "next";
import Link from "next/link";
import { CURRENT_PRIVACY_VERSION } from "@/legal/documents";
import { Card, Container, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = { title: "حریم خصوصی" };

export default function PrivacyPage() {
  return <main><Container className="max-w-3xl py-10 sm:py-16"><Card className="shadow-none">
    <p className="text-meta">نسخه {CURRENT_PRIVACY_VERSION}</p><h1 className="text-page-title mt-2">سیاست حریم خصوصی</h1>
    <div role="note" className="mt-6 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning"><strong>پیش‌نویس غیرقابل پذیرش:</strong> متن حقوقی مصوب سیاست حریم خصوصی هنوز توسط مالک محصول ارائه نشده است. هیچ دوره نگهداری، تضمین امنیتی یا ادعای انطباق قانونی در این صفحه فرض نشده است.</div>
    <p className="text-secondary mt-6">پیش از فعال‌سازی پذیرش کاربران، متن مصوب باید جایگزین این پیام شود و شناسه نسخه تغییر کند.</p>
    <Link href="/candidate/legal/acceptance" className={buttonClassNames({ variant: "secondary", className: "mt-7" })}>بازگشت به صفحه پذیرش</Link>
  </Card></Container></main>;
}
