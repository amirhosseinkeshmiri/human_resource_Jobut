import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "@/components/ui/container";
import { PUBLIC_JOBS_LABEL, PUBLIC_JOBS_ROUTE } from "@/jobs/public-copy";

const quickLinks = [
  ["خدمات ما", "/#services"],
  ["تعرفه‌ها", "/#pricing"],
  ["درباره ما", "/#about"],
  [PUBLIC_JOBS_LABEL, PUBLIC_JOBS_ROUTE],
  ["ارتباط با ما", "/#contact"],
];

const messagingLabels = ["ایتا", "بله", "واتساپ", "تلگرام", "اینستاگرام", "لینکدین"];

export function PublicFooter() {
  return (
    <footer id="contact" className="scroll-mt-32 border-t border-ui-border bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.15fr_0.75fr_1fr_1.1fr]">
        <div>
          <BrandLogo className="w-32" />
          <p className="text-label mt-3">شبکه استخدامی متخصصین آکادمیک</p>
          <p className="text-secondary mt-2">همراه شما در جذب و استخدام</p>
        </div>

        <nav aria-label="دسترسی سریع پایین صفحه">
          <h2 className="text-label">دسترسی سریع</h2>
          <ul className="mt-4 grid gap-2.5">
            {quickLinks.map(([label, href]) => (
              <li key={href}><Link href={href} className="text-sm text-text-secondary outline-none hover:text-text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">{label}</Link></li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-label">ارتباط با شبکه استخدامی متخصصین آکادمیک</h2>
          <div className="mt-4 grid gap-2.5 text-sm">
            <a href="https://www.jobut.ir" className="text-text-secondary outline-none hover:text-text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30" dir="ltr">www.jobut.ir</a>
            <a href="tel:09334414351" className="text-text-secondary outline-none hover:text-text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30" dir="ltr">09334414351</a>
          </div>
          <h3 className="text-label mt-6">ارتباط در پیامرسان‌ها</h3>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary" aria-label="پیام‌رسان‌ها و شبکه‌های اجتماعی">
            {messagingLabels.map((label) => <li key={label}>{label}</li>)}
          </ul>
        </div>

        <address className="not-italic">
          <h2 className="text-label">فرتاک سنجش فناوری پیشرو</h2>
          <div className="mt-4 grid gap-2.5 text-sm text-text-secondary">
            <a href="tel:02176250030" className="outline-none hover:text-text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30" dir="ltr">۰۲۱-۷۶۲۵۰۰۳۰</a>
            <a href="tel:09050948319" className="outline-none hover:text-text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30" dir="ltr">۰۹۰۵۰۹۴۸۳۱۹</a>
            <a href="mailto:info@fartaksfp.com" className="break-all outline-none hover:text-text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30" dir="ltr">info@fartaksfp.com</a>
            <p>پارک فناوری پردیس، دانش 4، ساختمان فناوران، طبقه 2، واحد ۲۰۳</p>
          </div>
        </address>
      </Container>
      <div className="border-t border-ui-border">
        <Container className="py-5 text-center text-xs text-text-muted">JOBUT · شبکه استخدامی متخصصین آکادمیک</Container>
      </div>
    </footer>
  );
}
