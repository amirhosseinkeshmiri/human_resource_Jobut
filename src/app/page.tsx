import Link from "next/link";
import { PublicFooter } from "@/components/landing/public-footer";
import { PublicHeader } from "@/components/landing/public-header";
import { Badge, Card, Container, buttonClassNames } from "@/components/ui";

const reasons = [
  {
    number: "۰۱",
    title: "تناسب بهتر",
    description: "نیاز واقعی موقعیت شغلی و توانمندی‌های کارجو با وضوح بیشتری کنار هم قرار می‌گیرند.",
  },
  {
    number: "۰۲",
    title: "تجربه ساده‌تر",
    description: "مسیر پیدا کردن فرصت و شروع استخدام، مستقیم و بدون پیچیدگی‌های غیرضروری طراحی می‌شود.",
  },
  {
    number: "۰۳",
    title: "فرصت‌های مرتبط‌تر",
    description: "تمرکز جاب‌اوت بر ارتباط معنادار میان خواسته‌های کارفرما و مسیر حرفه‌ای کارجو است.",
  },
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="border-b border-ui-border bg-surface">
          <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-center lg:py-28">
            <div className="max-w-3xl">
              <Badge>پلتفرم استخدام و کاریابی</Badge>
              <h1 className="text-page-title mt-5 max-w-2xl">
                فرصت شغلی مناسب، مسیر استخدام روشن‌تر
              </h1>
              <p className="text-body mt-5 max-w-2xl text-text-secondary">
                جاب‌اوت فضایی ساده برای نزدیک‌تر شدن توانمندی‌های کارجوها به نیازهای واقعی
                کارفرماهاست؛ با تمرکز بر فرصت‌های مرتبط و انتخاب آگاهانه‌تر.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="#jobs" className={buttonClassNames({ size: "large" })}>
                  مسیر پیدا کردن شغل
                </Link>
                <Link
                  href="#why-jobut"
                  className={buttonClassNames({ variant: "secondary", size: "large" })}
                >
                  چرا جاب‌اوت؟
                </Link>
              </div>
            </div>

            <Card className="grid gap-5 bg-surface-elevated lg:justify-self-end">
              <div>
                <p className="text-meta">یک مسیر متمرکز</p>
                <h2 className="text-card-title mt-1">استخدام، بدون شلوغی اضافه</h2>
              </div>
              <div className="grid gap-3">
                <div className="rounded-md border bg-surface p-4">
                  <p className="text-label">برای کارجو</p>
                  <p className="text-helper mt-1">شناخت و دنبال کردن فرصت‌های متناسب‌تر</p>
                </div>
                <div className="rounded-md border bg-surface p-4">
                  <p className="text-label">برای کارفرما</p>
                  <p className="text-helper mt-1">رسیدن به درک روشن‌تر از تناسب افراد و موقعیت‌ها</p>
                </div>
              </div>
            </Card>
          </Container>
        </section>

        <section id="jobs" aria-labelledby="jobs-title" className="scroll-mt-24">
          <Container className="py-[var(--section-spacing)]">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="neutral">فرصت‌های شغلی</Badge>
              <h2 id="jobs-title" className="text-section-title mt-4">
                نقطه شروع برای کشف مسیر بعدی
              </h2>
              <p className="text-secondary mt-3">
                جست‌وجوی فرصت‌های شغلی در مرحله بعد به این بخش متصل می‌شود.
              </p>
            </div>
            <Card className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-h-11 flex-1 rounded-md border bg-surface-elevated px-4 py-3 text-sm text-text-muted">
                عنوان شغلی یا حوزه کاری
              </div>
              <Badge className="self-start py-2.5 sm:self-auto">به‌زودی</Badge>
            </Card>
          </Container>
        </section>

        <section
          id="why-jobut"
          aria-labelledby="why-jobut-title"
          className="scroll-mt-24 border-y border-ui-border bg-surface"
        >
          <Container className="py-[var(--section-spacing)]">
            <div className="max-w-2xl">
              <p className="text-meta text-success">چرا جاب‌اوت</p>
              <h2 id="why-jobut-title" className="text-section-title mt-2">
                استخدام بهتر از درک بهتر شروع می‌شود
              </h2>
              <p className="text-secondary mt-3">
                جاب‌اوت برای ساده‌تر شدن ارتباط میان نیازهای یک موقعیت و توانمندی‌های افراد
                شکل می‌گیرد.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {reasons.map((reason) => (
                <Card key={reason.number} className="h-full shadow-none">
                  <span className="text-meta">{reason.number}</span>
                  <h3 className="text-card-title mt-5">{reason.title}</h3>
                  <p className="text-secondary mt-2">{reason.description}</p>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        <section aria-labelledby="matching-title">
          <Container className="py-[var(--section-spacing)]">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
              <div>
                <p className="text-meta text-success">تناسب رزومه و فرصت</p>
                <h2 id="matching-title" className="text-section-title mt-2">
                  یک ارتباط روشن میان تجربه و نیاز شغلی
                </h2>
                <p className="text-secondary mt-4">
                  ایده اصلی جاب‌اوت این است که اطلاعات حرفه‌ای کارجو و نیاز موقعیت شغلی،
                  ساختاریافته‌تر و قابل مقایسه‌تر کنار هم قرار بگیرند.
                </p>
              </div>

              <Card className="grid gap-4 bg-surface-elevated sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-md border bg-surface p-5">
                  <p className="text-meta">ورودی</p>
                  <h3 className="text-card-title mt-2">پروفایل و رزومه کارجو</h3>
                  <p className="text-helper mt-2">تجربه‌ها، توانمندی‌ها و مسیر حرفه‌ای</p>
                </div>
                <span aria-hidden="true" className="text-center text-xl text-text-muted">
                  ←
                </span>
                <div className="rounded-md border bg-surface p-5">
                  <p className="text-meta">مقصد</p>
                  <h3 className="text-card-title mt-2">فرصت شغلی مرتبط</h3>
                  <p className="text-helper mt-2">نیازها و انتظارات مشخص موقعیت شغلی</p>
                </div>
              </Card>
            </div>
          </Container>
        </section>

        <section aria-labelledby="login-title" className="border-t border-ui-border bg-surface">
          <Container className="py-[var(--section-spacing)]">
            <div className="mx-auto max-w-3xl text-center">
              <h2 id="login-title" className="text-section-title">
                مسیر مناسب خود را انتخاب کنید
              </h2>
              <p className="text-secondary mt-3">
                ورود در مراحل بعد فعال می‌شود. مقصد هر مسیر از حالا برای توسعه آینده آماده است.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/login/employer" className={buttonClassNames({ size: "large" })}>
                  ورود کارفرما
                </Link>
                <Link
                  href="/login/candidate"
                  className={buttonClassNames({ variant: "secondary", size: "large" })}
                >
                  ورود کارجو
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
