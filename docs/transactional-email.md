# ایمیل تراکنشی JobUT

## دامنه پیاده‌سازی‌شده

زیرساخت تولیدی ایمیل پیش از این تغییر وجود نداشت و ورود با شناسه ایمیل در production
عمداً unavailable بود. اکنون OTP ورود Candidate، Employer و Admin از همان چرخه امن
challenge، cooldown، rate limit، expiry و single-use موجود و از طریق SMTP ارسال می‌شود.
برای Admin فقط حساب از پیش provision شده پیام دریافت می‌کند و نتیجه عمومی همچنان
وجود یا عدم وجود حساب را افشا نمی‌کند.

اعلان ایمیلی برای application، پیام داخلی و پرداخت اضافه نشده است. requirement فعلی
برای پیام داخلی، اعلان خارجی را تصویب نکرده و مدل preference یا outbox تراکنشی برای
این رویدادها وجود ندارد. ارسال مستقیم از action می‌توانست هم consent را نادیده بگیرد
و هم در retry پیام تکراری ایجاد کند. این رویدادها تا تصویب preference و outbox به
همان داشبورد داخلی محدود می‌مانند.

## پیکربندی

- `EMAIL_PROVIDER=smtp`
- `EMAIL_FROM`: آدرس ساده و تأییدشده، مانند `no-reply@jobut.ir`
- `EMAIL_FROM_NAME=JobUT`
- `SMTP_HOST`: hostname بدون scheme یا port
- `SMTP_PORT`: معمولاً `465` برای TLS مستقیم یا `587` برای STARTTLS
- `SMTP_SECURE=true` برای TLS مستقیم و `false` برای STARTTLS اجباری
- `SMTP_USER` و `SMTP_PASS`: هر دو با هم؛ فقط در secret store
- `SMTP_TIMEOUT_MS`: بین ۱۰۰۰ و ۱۵۰۰۰؛ پیش‌فرض ۵۰۰۰

transport دسترسی URL/file را غیرفعال می‌کند، حداقل TLS 1.2 می‌خواهد، recipient را
اعتبارسنجی می‌کند و OTP یا credential را log نمی‌کند. شکست provider challenge رزروشده
را باطل می‌کند و خطای عمومی به کاربر می‌دهد. cooldown و قفل PostgreSQL از ارسال
تکراری ناشی از resend یا درخواست همزمان جلوگیری می‌کنند. محدودکننده توزیع‌شده موجود
نیز برای ایمیل با bucketهای مستقل identifier، IP، global و Admin اجرا می‌شود؛ بنابراین
مصرف سهمیه ایمیل سهمیه provider پیامک را کاهش نمی‌دهد.

## DNS و آزمون کنترل‌شده

پیش از production، دامنه فرستنده باید نزد provider تأیید و SPF و DKIM آن دقیقاً طبق
رکوردهای همان provider منتشر شود. DMARC ابتدا با policy مانیتورینگ و mailbox گزارش
معتبر فعال شود و پس از مشاهده delivery به policy سخت‌گیرانه ارتقا یابد. reverse DNS
برای SMTP اختصاصی نیز باید با provider هماهنگ باشد.

آزمون live فقط پس از تست staging با mailboxهای کنترل‌شده انجام شود: یک Candidate، یک
Employer و یک Admin از پیش provision شده، هر کدام یک OTP درخواست کنند؛ receipt، زمان
رسیدن، cooldown، انقضا و single-use بررسی شود. برای Admin یک شناسه ناشناخته نیز باید
همان outcome عمومی را بگیرد ولی هیچ ایمیلی دریافت نکند. سپس logهای provider فقط با
message ID و بدون OTP/recipient خام بررسی شوند. تست‌های خودکار هیچ اتصال SMTP ندارند.

## عیب‌یابی امن OTP در Runflare

شکست‌ها با یک JSON تک‌خطی روی `stderr` و event برابر `otp_delivery_failure` ثبت
می‌شوند. فیلدها فقط شامل `correlationId`، `stage`، `provider`، `errorCode` و
`durationMs` هستند. هیچ OTP، ایمیل، موبایل، credential، token یا پاسخ خام provider
ثبت نمی‌شود.

معنای stageها:

- `account_lookup`: lookup حساب Admin پیش از صدور challenge شکست خورده است.
- `challenge_reserve`: دسترسی یا transaction پایگاه داده شکست خورده است.
- `rate_limit`: quota، اتصال limiter یا تشخیص IP مورد اعتماد شکست خورده است.
- `provider_delivery`: پیکربندی، DNS، شبکه، TLS یا authentication provider شکست خورده است.
- `challenge_activate`: provider پاسخ داده ولی فعال‌سازی اتمیک challenge شکست خورده است.
- `challenge_invalidate`: پاک‌سازی fail-closed پس از شکست نیز ناموفق بوده است.

برای پورت ۵۸۷ مقدار `SMTP_SECURE=false` الزامی است؛ transport در این حالت
`requireTLS=true` دارد و downgrade به اتصال plaintext مجاز نیست. برای پورت ۴۶۵ مقدار
`SMTP_SECURE=true` الزامی است.
