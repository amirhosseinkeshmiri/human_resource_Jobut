# پیامک OTP اختصاصی Jobut

در production، ورود موبایلی Employer، Candidate و Adminهای از قبل ایجادشده از API قالب اشتراکی MeliPayamak استفاده می‌کند. endpoint شامل credential محرمانه در path است و نباید در کد، مرورگر، پاسخ خطا یا لاگ قرار بگیرد.

## قرارداد

- درخواست: `POST` با JSON دقیق `{ "bodyId": 561397, "to": "09123456789", "args": ["123456"] }`
- پاسخ معتبر: JSON دارای `recId` عددی و `status` متنی، مانند `{ "recId": 3741437414, "status": "" }`
- `args` دقیقاً یک عضو دارد: OTP شش‌رقمی به‌صورت string تا صفر ابتدایی حفظ شود. متن آزاد، شماره فرستنده، API key field یا داده هویتی کاربر ارسال نمی‌شود.

کد شش‌رقمی را Jobut با random cryptographic تولید می‌کند. Jobut ابتدا challenge منقضی و غیرقابل‌استفاده رزرو می‌کند، OTP خام را فقط به‌عنوان آرگومان قالب در درخواست شبکه می‌فرستد و پس از پاسخ معتبر provider فقط HMAC کد را در مرحله فعال‌سازی ذخیره می‌کند. OTP خام نه persist و نه log می‌شود.

## متغیرهای production

```text
SMS_PROVIDER=melipayamak
MELIPAYAMAK_SHARED_ENDPOINT=<secret full /api/send/shared/... endpoint>
MELIPAYAMAK_BODY_ID=561397
SMS_TIMEOUT_MS=5000
AUTH_TRUSTED_PROXY_HOPS=1
SMS_RATE_LIMIT_IDENTIFIER_MAX=3
SMS_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS=600
SMS_RATE_LIMIT_IP_MAX=10
SMS_RATE_LIMIT_IP_WINDOW_SECONDS=600
SMS_RATE_LIMIT_GLOBAL_MAX=100
SMS_RATE_LIMIT_GLOBAL_WINDOW_SECONDS=60
SMS_RATE_LIMIT_ADMIN_IDENTIFIER_MAX=2
SMS_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS=900
SMS_RATE_LIMIT_ADMIN_IP_MAX=4
SMS_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS=900
APP_URL=https://www.jobut.ir
```

endpoint باید HTTPS، با مسیر `/api/send/shared/...`، بدون redirect/query/fragment/URL credentials، روی hostname دقیق `console.melipayamak.com` و پورت استاندارد باشد. `MELIPAYAMAK_BODY_ID` باید عدد صحیح مثبت باشد. `AUTH_SECRET` موجود برای HMAC استفاده می‌شود.

محدودکننده پیامک با شمارنده‌های اتمیک PostgreSQL و پیش از فراخوانی provider اجرا می‌شود. کلید شماره و IP با HMAC ساخته می‌شود و مقدار خام آن‌ها در جدول limiter ذخیره نمی‌شود. سهمیه شناسه میان Employer و Candidate و Admin مشترک است و Admin علاوه بر آن محدودیت سخت‌گیرانه‌تری دارد. شکست provider سهمیه رزروشده را برنمی‌گرداند تا failure قابل سوءاستفاده نباشد؛ خرابی limiter نیز ارسال را fail-closed متوقف می‌کند.

در ورود Admin، شناسه‌های معتبر از نظر قالب همیشه پاسخ عمومی challenge‌شکل یکسان می‌گیرند. شناسه ناشناخته از limiter سخت‌گیرانه Admin عبور می‌کند و فقط محاسبه رمزنگاری decoy انجام می‌دهد؛ هیچ پیامک، challenge پایدار، حساب یا session برای آن ساخته نمی‌شود. خطاهای provider، cooldown و verification نیز وجود حساب را در پیام یا redirect آشکار نمی‌کنند.

`AUTH_TRUSTED_PROXY_HOPS` باید دقیقاً با تعداد reverse proxyهای مورد اعتماد بین کاربر و برنامه برابر باشد. برنامه IP را از مرز سمت راست `X-Forwarded-For` انتخاب و مقادیر سمت چپ را نادیده می‌گیرد. مبدأ برنامه باید فقط از ingress مورد اعتماد Runflare قابل دسترسی باشد و ingress باید IP اتصال را به header اضافه کند؛ در غیر این صورت هیچ تنظیم نرم‌افزاری نمی‌تواند header ارسالی مستقیم کاربر را قابل اعتماد کند.

## آزمون عملیاتی

1. endpoint کامل و محرمانه shared service را از پنل MeliPayamak دریافت و body ID تأییدشده `561397` را تنظیم کنید.
2. migration شمارنده توزیع‌شده را پس از بازبینی دستی اجرا کنید.
3. متغیرها را فقط در secretهای Runflare تنظیم، تعداد proxy hop را با زیرساخت تأیید و deployment را restart کنید.
4. برای شماره‌های کنترل‌شده، ورود موبایلی Employer و Candidate و سپس Admin از قبل ایجادشده را آزمایش کنید.
5. cooldown یک‌دقیقه‌ای، سهمیه‌های identifier/IP/global، انقضای ده‌دقیقه‌ای، سقف پنج تلاش، یک‌بارمصرف بودن و باطل شدن کد قدیمی پس از resend را بررسی کنید.
6. لاگ‌ها و bundle مرورگر را از نبود شماره، IP، OTP و endpoint بازبینی کنید.

ارسال ایمیل خارج از این integration است و همچنان provider تولیدی ندارد. cooldown با قفل advisory و داده challenge در PostgreSQL اعمال می‌شود و limiter حافظه‌ای یا وابستگی Redis اضافه نشده است.
