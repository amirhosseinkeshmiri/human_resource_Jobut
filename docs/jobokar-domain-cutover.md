# چک‌لیست انتقال دامنه جابوکار

این سند فقط برای Stage B است. در Stage A نام تجاری محصول «جابوکار / Jobokar» است، اما
دامنه عملیاتی، origin احراز هویت، callback پرداخت و URLهای عمومی همچنان `jobut.ir`
می‌مانند. هیچ‌یک از تغییرات این سند نباید پیش از آماده‌شدن DNS، TLS، Runflare و
ثبت‌های provider اعمال شود.

## ماتریس پیکربندی

| مورد | Stage A فعلی | Stage B پس از تأیید |
|---|---|---|
| دامنه canonical | `https://www.jobut.ir` | `https://jobokar.com` یا `https://www.jobokar.com`؛ یکی انتخاب شود |
| `APP_URL` | origin فعلی `jobut.ir` | origin canonical تأییدشده `jobokar.com` |
| `SEP_CALLBACK_URL` | callback فعلی `jobut.ir` | callback جدید فقط پس از ثبت در پنل SEP |
| origin احراز هویت/CSRF | origin فعلی | origin جدید پس از deploy هماهنگ |
| cookieها | نام و policy فعلی | بدون rename؛ Secure/HttpOnly/SameSite حفظ شود |
| ایمیل فرستنده | دامنه فعلی تأییدشده | دامنه جدید پس از SPF/DKIM/DMARC |
| قالب MeliPayamak | Body ID و endpoint فعلی | متن برند پس از تأیید پنل؛ Body ID خودکار تغییر نکند |
| canonical/robots/sitemap | از `APP_URL` فعلی | با تغییر کنترل‌شده `APP_URL` به دامنه جدید |
| redirect دامنه قدیمی | غیرفعال | 301 حفظ‌کننده path و query پس از پایدارشدن callbacks |

## ترتیب cutover

1. مالکیت `jobokar.com` در DNS و Search Console تأیید شود.
2. دامنه apex و در صورت انتخاب، `www` در Runflare متصل و TLS معتبر روی هر دو hostname
   بررسی شود. یکی از آن‌ها canonical انتخاب شود.
3. پیش از تغییر برنامه، `https://<new-origin>/`, `/jobs`, `/robots.txt` و `/sitemap.xml`
   روی deployment آزمایشی بدون redirect دامنه قدیمی بررسی شوند.
4. URL callback جدید در پنل SEP ثبت و پذیرش آن کتبی/عملی تأیید شود. callback قدیمی تا
   پایان تراکنش‌های معلق و دوره reconciliation فعال بماند.
5. در یک release هماهنگ، `APP_URL` و `SEP_CALLBACK_URL` به origin جدید تغییر کنند.
   `AUTH_SECRET`، نام cookieها، sessionها و داده‌های پایگاه تغییر نکنند.
6. OTP کارجو، کارفرما و مدیر روی origin جدید با حساب‌های کنترل‌شده smoke-test شود؛
   origin/CSRF، cooldown، single-use و role isolation باید بدون تغییر کار کنند.
7. پرداخت آزمایشی کنترل‌شده فقط پس از تأیید merchant انجام و request/callback/verify/
   reconciliation بررسی شود. redirect callback نباید بین دو دامنه واسطه بخورد.
8. نام نمایشی ایمیل پس از تأیید برند `Jobokar` بماند. تغییر دامنه فرستنده فقط پس از
   انتشار SPF، DKIM و DMARC و آزمون mailboxهای کنترل‌شده انجام شود.
9. متن قالب MeliPayamak در پنل برای «جابوکار» بازبینی شود. Body ID `561397` یا endpoint
   فعال بدون تأیید provider تغییر نکند.
10. پس از تأیید سلامت release، canonical، sitemap و robots روی دامنه جدید بررسی و
    migration دامنه در Search Console آغاز شود.
11. سپس redirect دائمی 301 از `jobut.ir` به دامنه جدید با حفظ path و queryهای امن فعال
    شود. مسیرهای callback قدیمی تا پایان بازه سازگاری از redirect عمومی مستثنا بمانند.
12. دامنه قدیمی، TLS و مانیتورینگ آن حداقل در دوره انتقال SEO و پرداخت حفظ شوند.

## کنترل و rollback

- پیش از cutover، image قبلی و snapshot کامل environment نگه داشته شود.
- rollback شامل بازگرداندن `APP_URL` و `SEP_CALLBACK_URL`، image قبلی و غیرفعال‌کردن
  redirect دامنه قدیمی است؛ DNS و TLS قدیمی حذف نشوند.
- migration پایگاه داده، rename cookie، تغییر شناسه session یا بازنویسی URLهای تاریخی
  برای این cutover لازم نیست.
- بعد از هر تغییر، headerهای cache/security، لاگ‌های origin rejection، OTP، callback
  SEP و خطاهای provider بدون ثبت داده حساس پایش شوند.
