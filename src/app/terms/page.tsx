import type { Metadata } from "next";
import Link from "next/link";
import { CURRENT_TERMS_VERSION } from "@/legal/documents";
import { Card, Container, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = { title: "شرایط استفاده" };

export default function TermsPage() {
  return <main><Container className="max-w-3xl py-10 sm:py-16"><Card className="shadow-none">
    <p className="text-meta">نسخه {CURRENT_TERMS_VERSION}</p><h1 className="text-page-title mt-2">شرایط استفاده</h1>
    <div role="note" className="mt-6 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning"><strong>پیش‌نویس غیرقابل پذیرش:</strong> متن حقوقی مصوب شرایط استفاده هنوز توسط مالک محصول ارائه نشده است. این صفحه هیچ تعهد، تضمین یا ادعای حقوقی تازه‌ای ایجاد نمی‌کند.</div>
    <p className="text-secondary mt-6">پیش از فعال‌سازی پذیرش کاربران، متن مصوب باید جایگزین این پیام شود و شناسه نسخه تغییر کند.</p>
    <Link href="/candidate/legal/acceptance" className={buttonClassNames({ variant: "secondary", className: "mt-7" })}>بازگشت به صفحه پذیرش</Link>
  </Card></Container></main>;
}
