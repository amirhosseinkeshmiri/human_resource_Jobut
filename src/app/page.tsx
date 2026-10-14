import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "@/components/landing/public-footer";
import { PublicHeader } from "@/components/landing/public-header";
import { Badge, Card, Container, buttonClassNames } from "@/components/ui";

export const metadata: Metadata = {
  title: "شبکه استخدامی متخصصین آکادمیک",
  description: "شبکه استخدامی متخصصین آکادمیک؛ همراه سازمان‌ها در جذب و استخدام متخصصین دانشگاهی.",
};

const trustHighlights = [
  "دسترسی به استعدادهای برتر",
  "همکاری با سازمان‌های معتبر",
  "فرصت‌های شغلی معتبر",
  "برترین سرمایه‌های انسانی",
];

const services = [
  {
    number: "۰۱",
    title: "انتشار گسترده آگهی‌های استخدامی",
    description: "آگهی‌های استخدامی پس از بررسی و تأیید، در کانال‌ها و شبکه‌های اجتماعی شبکه استخدامی متخصصین آکادمیک منتشر می‌شوند تا فرصت‌های شغلی به جامعه‌ای گسترده از متخصصین آکادمیک معرفی شوند.",
    note: "در صورت نیاز، آگهی پس از بررسی مجدد یک نوبت دیگر منتشر می‌شود.",
    cta: "مشاهده تعرفه‌ها",
    href: "#pricing",
  },
  {
    number: "۰۲",
    title: "بانک رزومه غربال‌شده",
    description: "تهیه بانک رزومه متناسب با نیاز کارفرما، همراه با بررسی اولیه، ارزیابی انگیزه شغلی، تطابق رفتاری و انتخاب کاندیداهای مناسب.",
    note: "امکان ارائه رزومه‌های منتخب همراه با گزارش ارزیابی و امتیازدهی وجود دارد.",
    cta: "درخواست همکاری",
    href: "#contact",
  },
  {
    number: "۰۳",
    label: "ضمانت جایگزینی",
    title: "هد هانتینگ",
    description: "مدیریت فرآیند جذب از شناسایی و ارزیابی کاندیداها تا مذاکرات اولیه، مصاحبه‌های تخصصی و همراهی تا شروع همکاری.",
    note: "در صورت عدم ماندگاری یا عدم رضایت کارفرما در بازه کمتر از ۳۰ روز کاری، فرآیند جذب مجدد بدون هزینه اضافه انجام می‌شود.",
    cta: "درخواست مشاوره",
    href: "#contact",
  },
  {
    number: "۰۴",
    title: "آموزش سازمانی",
    description: "طراحی و برگزاری دوره‌های آموزشی اختصاصی برای سازمان‌ها در حوزه‌هایی مانند برند کارفرمایی، جذب و نگهداشت و بهینه‌سازی فرآیندهای منابع انسانی.",
    note: "محتوای هر دوره بر اساس نیازهای واقعی سازمان طراحی می‌شود.",
    cta: "درخواست مشاوره",
    href: "#contact",
  },
];

const reasons = [
  { title: "تطابق هوشمند", description: "شناسایی و معرفی فرصت‌ها و متخصصین متناسب با نیاز سازمان و ویژگی‌های هر موقعیت شغلی." },
  { title: "پشتیبانی خدمات", description: "همراهی و پاسخ‌گویی در طول فرآیند ارائه خدمات برای ایجاد تجربه‌ای شفاف‌تر و مؤثرتر." },
  { title: "طراحی مسیر شغلی", description: "کمک به توسعه حرفه‌ای و ایجاد مسیر روشن‌تر برای رشد، توانمندسازی و پیشرفت شغلی." },
  { title: "امنیت و حریم خصوصی", description: "مدیریت اطلاعات کاربران و سازمان‌ها با رویکردی مسئولانه و توجه به محرمانگی اطلاعات." },
];

const performance = [
  { value: "۲۰۰ هزار+", title: "نفر ساعت آموزش", description: "آموزش‌های تخصصی برگزارشده" },
  { value: "۱۰۰۰+", title: "کارفرمای همکار", description: "همکاری با سازمان‌ها و کسب‌وکارها" },
  { value: "۱۰ هزار+", title: "آگهی منتشرشده", description: "فرصت‌های استخدامی منتشرشده در شبکه" },
  { value: "۷۳٪", title: "موفقیت در جذب", description: "" },
];

const plans = [
  { name: "تک آگهی - آزاد", credit: "۱ آگهی / ۷ روز", unitPrice: "۳۹۹,۰۰۰ تومان", totalPrice: "۳۹۹,۰۰۰ تومان", payment: ["نقد ابتدای دوره"] },
  { name: "سه ماهه", credit: "۶ آگهی / ۹۰ روز", unitPrice: "۳۵۰,۰۰۰ تومان", totalPrice: "۲,۱۰۰,۰۰۰ تومان", payment: ["نقد ابتدای دوره"] },
  { name: "شش ماهه", credit: "۱۵ آگهی / ۱۸۰ روز", unitPrice: "۳۰۰,۰۰۰ تومان", totalPrice: "۴,۵۰۰,۰۰۰ تومان", payment: ["نقد ابتدای دوره"] },
  { name: "یک ساله", credit: "۳۵ آگهی / ۳۶۵ روز", unitPrice: "۲۵۰,۰۰۰ تومان", totalPrice: "۸,۷۵۰,۰۰۰ تومان", payment: ["نقد ابتدای دوره"] },
  { name: "یک ساله نامحدود", credit: "۳۵۰ آگهی / ۳۶۵ روز + ۳ ماه بیشتر", unitPrice: "۲۰۰,۰۰۰ تومان", totalPrice: "۷۰,۰۰۰,۰۰۰ تومان", payment: ["سه قسط", "۳۰ میلیون", "۲۰ میلیون", "۲۰ میلیون"] },
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-ui-border bg-surface" aria-labelledby="hero-title">
          <Image
            src="/brand/Hero_desktop.png"
            alt="نمایی از متخصصان آکادمیک در سراسر ایران"
            width={1672}
            height={941}
            priority
            className="hidden h-auto w-full sm:block"
          />
          <Image
            src="/brand/Hero_mobile.png"
            alt="نمایی از متخصصان آکادمیک در سراسر ایران"
            width={941}
            height={1672}
            priority
            className="h-auto w-full sm:hidden"
          />
          <div className="absolute inset-x-0 top-[4%] sm:top-[7%] lg:top-[10%]">
            <Container className="flex justify-center sm:justify-end">
              <div className="max-w-[19rem] rounded-xl border border-white/80 bg-white/90 p-4 text-center shadow-[0_12px_35px_rgb(20_33_145/0.12)] backdrop-blur-sm sm:max-w-md sm:p-6 lg:text-start">
                <p className="text-xs font-bold tracking-wide text-accent">JOBUT</p>
                <h1 id="hero-title" className="font-brand mt-2 text-[clamp(1.55rem,3.5vw,3.25rem)] font-bold leading-[1.3] text-action">همراه شما در جذب و استخدام</h1>
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
                  <Link href="#contact" className={buttonClassNames({ size: "small" })}>درخواست همکاری</Link>
                  <Link href="/jobs" className={buttonClassNames({ variant: "secondary", size: "small" })}>مشاهده آگهی‌ها</Link>
                </div>
              </div>
            </Container>
          </div>
        </section>

        <section aria-label="ارزش‌های شبکه استخدامی متخصصین آکادمیک" className="border-b border-ui-border bg-page">
          <Container className="grid grid-cols-2 gap-px bg-ui-border py-0 lg:grid-cols-4">
            {trustHighlights.map((item) => <p key={item} className="bg-page px-4 py-6 text-center text-sm font-semibold sm:px-6">{item}</p>)}
          </Container>
        </section>

        <section id="services" aria-labelledby="services-title" className="scroll-mt-32">
          <Container className="py-[var(--section-spacing)]">
            <div className="max-w-3xl">
              <p className="text-meta text-accent">راهکارهای تخصصی جذب و توسعه سرمایه انسانی</p>
              <h2 id="services-title" className="text-section-title mt-2">خدمات ما</h2>
              <p className="text-secondary mt-3">شبکه استخدامی متخصصین آکادمیک با تمرکز بر نیازهای واقعی سازمان‌ها، خدمات تخصصی جذب، شناسایی و توسعه سرمایه‌های انسانی را ارائه می‌کند.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <Card key={service.number} className="flex h-full flex-col shadow-none">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-meta">{service.number}</span>
                    {service.label ? <Badge variant="success">{service.label}</Badge> : null}
                  </div>
                  <h3 className="text-card-title mt-5">{service.title}</h3>
                  <p className="text-secondary mt-3">{service.description}</p>
                  <p className="text-helper mt-4 border-t border-ui-border pt-4">{service.note}</p>
                  <Link href={service.href} className="mt-auto pt-6 text-sm font-semibold text-action outline-none hover:text-action-hover focus-visible:rounded focus-visible:ring-2 focus-visible:ring-focus/30">{service.cta} ←</Link>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        <section id="why-jobut" aria-labelledby="why-jobut-title" className="scroll-mt-32 border-y border-ui-border bg-surface">
          <Container className="py-[var(--section-spacing)]">
            <div className="max-w-3xl">
              <p className="text-meta text-accent">مزیت همکاری با شبکه استخدامی متخصصین آکادمیک</p>
              <h2 id="why-jobut-title" className="text-section-title mt-2">چرا شبکه استخدامی متخصصین آکادمیک؟</h2>
              <p className="text-secondary mt-3">ترکیبی از شبکه تخصصی، شناخت بازار کار و همراهی حرفه‌ای در فرآیند جذب و توسعه مسیر شغلی.</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {reasons.map((reason, index) => (
                <Card key={reason.title} className="h-full shadow-none">
                  <span className="text-meta">۰{index + 1}</span>
                  <h3 className="text-card-title mt-5">{reason.title}</h3>
                  <p className="text-secondary mt-2">{reason.description}</p>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        <section id="about" aria-labelledby="about-title" className="scroll-mt-32">
          <Container className="grid gap-10 py-[var(--section-spacing)] lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-start">
            <div>
              <p className="text-meta text-accent">شبکه استخدامی متخصصین آکادمیک</p>
              <h2 id="about-title" className="text-section-title mt-2">درباره شبکه استخدامی متخصصین آکادمیک</h2>
              <div className="mt-5 grid gap-4 text-secondary">
                <p>شبکه استخدامی متخصصین آکادمیک در سال ۱۳۹۵ توسط جمعی از دانشجویان دانشگاه تهران، با هدف تسهیل دسترسی کارفرمایان و کارجویان به فرصت‌های بهتر تأسیس شد.</p>
                <p>امروز شبکه استخدامی متخصصین آکادمیک با جامعه‌ای بیش از ۱۲۵ هزار نفر از فارغ‌التحصیلان و متخصصین دانشگاهی ایران، بستری برای دسترسی سازمان‌ها به نیروهای متخصص، توانمند و بااستعداد فراهم کرده است.</p>
                <p>تمرکز شبکه استخدامی متخصصین آکادمیک بر شناسایی و معرفی سرمایه‌های انسانی مناسب، به شرکت‌ها کمک می‌کند فرآیند جذب خود را سریع‌تر و مؤثرتر پیش ببرند و با استفاده از ظرفیت متخصصین آکادمیک، توانمندی سازمان خود را توسعه دهند.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="shadow-none"><p className="text-meta">آموزش تخصصی</p><p className="mt-2 text-2xl font-bold">+۲۰۰ هزار نفر ساعت</p></Card>
              <Card className="shadow-none"><p className="text-meta">اعتماد سازمانی</p><p className="mt-2 text-2xl font-bold">همکاری با +۱۰۰۰ کارفرما</p></Card>
            </div>
          </Container>
        </section>

        <section aria-labelledby="mission-title" className="border-y border-ui-border bg-surface">
          <Container className="py-[var(--section-spacing)]">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-meta text-accent">ماموریت شبکه استخدامی متخصصین آکادمیک</p>
              <h2 id="mission-title" className="text-section-title mt-2">برای ساختن آینده بهتر</h2>
              <p className="text-body mt-5 text-text-secondary">شبکه استخدامی متخصصین آکادمیک می‌کوشد با همراهی مدیران کسب‌وکار، صاحبان صنایع و خبرگان دانشگاهی، بستری برای شناسایی و جذب استعدادهای توانمند، ارتقای سرمایه انسانی و توسعه پایدار کسب‌وکارها و صنعت ایران فراهم کند.</p>
            </div>
          </Container>
        </section>

        <section aria-labelledby="performance-title">
          <Container className="py-[var(--section-spacing)]">
            <div className="max-w-3xl">
              <p className="text-meta text-accent">عملکرد شبکه</p>
              <h2 id="performance-title" className="text-section-title mt-2">شبکه استخدامی متخصصین آکادمیک در یک نگاه</h2>
              <p className="text-secondary mt-3">نگاهی به بخشی از عملکرد شبکه استخدامی متخصصین آکادمیک</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {performance.map((item) => (
                <Card key={item.value} className="shadow-none">
                  <p className="text-2xl font-bold text-action sm:text-3xl">{item.value}</p>
                  <h3 className="text-label mt-3">{item.title}</h3>
                  {item.description ? <p className="text-helper mt-1">{item.description}</p> : null}
                </Card>
              ))}
            </div>
          </Container>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-32 border-y border-ui-border bg-surface">
          <Container className="py-[var(--section-spacing)]">
            <div className="max-w-3xl">
              <p className="text-meta text-accent">تعرفه خدمات</p>
              <h2 id="pricing-title" className="text-section-title mt-2">تعرفه‌ها</h2>
              <p className="text-secondary mt-3">راهکار متناسب با نیاز سازمان خود را انتخاب کنید و برای شروع همکاری با شبکه استخدامی متخصصین آکادمیک درخواست خود را ثبت کنید.</p>
            </div>

            <div aria-label="دسته‌بندی خدمات" className="mt-7 flex flex-wrap gap-2">
              <span className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-white">انتشار آگهی</span>
              {['بانک رزومه', 'هد هانتینگ', 'آموزش سازمانی'].map((category) => <span key={category} className="rounded-full border bg-surface px-4 py-2 text-sm font-medium text-text-secondary">{category}</span>)}
            </div>

            <Card className="mt-6 shadow-none">
              <h3 className="text-card-title">انتشار گسترده آگهی‌های استخدامی</h3>
              <p className="text-secondary mt-3">انتشار آگهی در کانال‌های شبکه استخدامی متخصصین آکادمیک. هر آگهی پس از تأیید، ابتدا در شبکه‌های اجتماعی منتشر می‌شود و سپس در پایان هفته در فهرست آگهی‌ها قرار می‌گیرد. در صورتی که رزومه کافی جذب نشود، پس از بررسی مجدد آگهی و اعمال تغییرات، یک نوبت دیگر منتشر خواهد شد.</p>
              <p className="text-label mt-4">ساختار پرداخت: تسویه کامل مبلغ قرارداد در ابتدای دوره همکاری</p>
            </Card>

            <div className="mt-6 grid gap-4 lg:hidden">
              {plans.map((plan) => (
                <Card key={plan.name} className="shadow-none">
                  <h3 className="text-card-title">{plan.name}</h3>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-text-muted">اعتبار</dt><dd className="text-end font-medium">{plan.credit}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-text-muted">قیمت هر واحد</dt><dd className="text-end font-medium">{plan.unitPrice}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-text-muted">قیمت کل</dt><dd className="text-end font-bold">{plan.totalPrice}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-text-muted">نوع پرداخت</dt><dd className="text-end">{plan.payment.map((line) => <span key={line} className="block">{line}</span>)}</dd></div>
                  </dl>
                  <Link href="/login/employer" className={buttonClassNames({ className: "mt-5 w-full" })}>ثبت سفارش</Link>
                </Card>
              ))}
            </div>

            <div className="mt-6 hidden overflow-hidden rounded-lg border lg:block">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface-elevated text-text-secondary">
                  <tr>{['پلن', 'اعتبار', 'قیمت هر واحد', 'قیمت کل', 'نوع پرداخت', 'عملیات'].map((heading) => <th key={heading} scope="col" className="px-4 py-4 text-start font-semibold">{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-ui-border">
                  {plans.map((plan) => (
                    <tr key={plan.name} className="bg-surface align-top">
                      <th scope="row" className="px-4 py-5 text-start font-semibold">{plan.name}</th>
                      <td className="px-4 py-5">{plan.credit}</td>
                      <td className="px-4 py-5">{plan.unitPrice}</td>
                      <td className="px-4 py-5 font-semibold">{plan.totalPrice}</td>
                      <td className="px-4 py-5">{plan.payment.map((line) => <span key={line} className="block">{line}</span>)}</td>
                      <td className="px-4 py-5"><Link href="/login/employer" className={buttonClassNames({ size: "small" })}>ثبت سفارش</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>
        </section>

        <section aria-labelledby="final-cta-title">
          <Container className="py-[var(--section-spacing)]">
            <Card className="bg-action p-7 text-white shadow-none sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div className="max-w-3xl">
                <p className="text-sm text-white/75">همراه سازمان شما</p>
                <h2 id="final-cta-title" className="text-section-title mt-2 text-white">برای جذب بهترین استعدادها آماده‌اید؟</h2>
                <p className="mt-3 text-sm leading-7 text-white/85">شبکه استخدامی متخصصین آکادمیک، همراه شما برای دسترسی به شبکه‌ای از متخصصین آکادمیک ایران و ساختن یک فرآیند جذب حرفه‌ای‌تر.</p>
              </div>
              <div className="mt-7 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0">
                <Link href="#contact" className={buttonClassNames({ variant: "secondary", size: "large", className: "border-white bg-white" })}>شروع همکاری</Link>
                <Link href="#pricing" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/50 px-5 text-base font-semibold text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">مشاهده تعرفه‌ها</Link>
              </div>
            </Card>
          </Container>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
