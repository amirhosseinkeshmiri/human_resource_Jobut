# پیامک OTP اختصاصی Jobut

در production، ورود موبایلی Employer، Candidate و Adminهای از قبل ایجادشده می‌تواند از API بومی OTP یا API قالب اشتراکی MeliPayamak استفاده کند. حالت production جدید JobUT برابر `native_otp` است. endpoint شامل credential محرمانه در path است و نباید در کد، مرورگر، پاسخ خطا یا لاگ قرار بگیرد.

## قرارداد

- native OTP: درخواست `POST` به endpoint محرمانه `/api/send/otp/...` با JSON دقیق `{ "to": "09123456789" }` است. پاسخ موفق باید HTTP موفق و JSON با `status` خالی و `code` رشته عددی معتبر داشته باشد.
- `code` را provider تولید می‌کند. JobUT آن را فقط در حافظه دریافت و بلافاصله HMAC می‌کند؛ مقدار plaintext persist، log یا به client برگردانده نمی‌شود.
- مستند پنل طول دقیق `code` را تعیین نکرده و مثال ده‌رقمی صرفاً مثال است. سیاست امنیتی JobUT فعلاً فقط ASCII digit با طول ۶ تا ۳۲ را می‌پذیرد؛ مقدار خارج این بازه fail-closed است.
- shared template سازگار قبلی: درخواست `{ "bodyId": 561397, "to": "09123456789", "args": ["123456"] }` و پاسخ پذیرفته‌شده دارای `recId` دهدهی مثبت (نوع رشته در مستند رسمی و نوع عدد برای سازگاری) و `status` خالی است.
- در هر دو حالت، HTTP 200 به‌تنهایی موفقیت نیست و `status` غیرخالی رد provider است. پذیرش API نیز به معنی تحویل قطعی به گوشی نیست.

کد شش‌رقمی را Jobut با random cryptographic تولید می‌کند. Jobut ابتدا challenge منقضی و غیرقابل‌استفاده رزرو می‌کند، OTP خام را فقط به‌عنوان آرگومان قالب در درخواست شبکه می‌فرستد و پس از پاسخ معتبر provider فقط HMAC کد را در مرحله فعال‌سازی ذخیره می‌کند. OTP خام نه persist و نه log می‌شود.

## متغیرهای production

```text
SMS_PROVIDER=melipayamak
MELIPAYAMAK_SENDING_MODE=native_otp
MELIPAYAMAK_OTP_ENDPOINT=<rotated secret full /api/send/otp/... endpoint>
SMS_TIMEOUT_MS=5000
OTP_RATE_LIMIT_IDENTIFIER_MAX=3
OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS=600
OTP_RATE_LIMIT_ACCOUNT_MAX=3
OTP_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS=600
OTP_RATE_LIMIT_GLOBAL_MAX=100
OTP_RATE_LIMIT_GLOBAL_WINDOW_SECONDS=60
OTP_RATE_LIMIT_ADMIN_IDENTIFIER_MAX=2
OTP_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS=900
OTP_PROVIDER_CIRCUIT_FAILURE_MAX=5
OTP_PROVIDER_CIRCUIT_WINDOW_SECONDS=300
OTP_IP_RATE_LIMIT_ENABLED=false
# فقط پس از تأیید قرارداد ingress:
AUTH_TRUSTED_PROXY_HOPS=
OTP_RATE_LIMIT_IP_MAX=10
OTP_RATE_LIMIT_IP_WINDOW_SECONDS=600
OTP_RATE_LIMIT_ADMIN_IP_MAX=4
OTP_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS=900
APP_URL=https://www.jobut.ir
```

endpoint باید HTTPS، با مسیر `/api/send/otp/...`، بدون redirect/query/fragment/URL credentials، روی hostname دقیق `console.melipayamak.com` و پورت استاندارد باشد. native mode به `MELIPAYAMAK_BODY_ID` نیاز ندارد. `AUTH_SECRET` موجود برای HMAC استفاده می‌شود.

برای installation قبلی، نبود `MELIPAYAMAK_SENDING_MODE` به‌صورت backward-compatible برابر `shared_template` است؛ در آن حالت `MELIPAYAMAK_SHARED_ENDPOINT` و `MELIPAYAMAK_BODY_ID` همچنان اجباری‌اند. برای فعال‌سازی native mode باید mode صریحاً `native_otp` باشد.

در native mode نام کاربری، رمز عبور، Body ID، OTP محلی یا شماره فرستنده در body وجود ندارد. هر `status` غیرخالی رد عمومی است، چون مستند پنل برای native endpoint جدول error code ارائه نکرده است. متن خام status در log ذخیره نمی‌شود.

startup در production همین انتخاب provider، endpoint کامل، Body ID و timeout بین
۱۰۰۰ تا ۱۵۰۰۰ میلی‌ثانیه را پیش از شروع سرور بررسی می‌کند. هر تلاش provider فقط با
correlation ID، mode، outcome، دسته/کد امن و زمان اجرا log می‌شود؛ endpoint، شماره،
OTP، body و متن خام پاسخ log نمی‌شوند.

محدودکننده OTP با رویدادهای rolling-window و قفل transaction-level اتمیک PostgreSQL و پیش از فراخوانی provider اجرا می‌شود. کلید شناسه، حساب و IP با HMAC ساخته می‌شود و مقدار خام در جدول limiter ذخیره نمی‌شود. سهمیه شناسه میان نقش‌ها مشترک، سهمیه حساب برای هر نقش جدا، بودجه provider سراسری و Admin دارای bucket سخت‌گیرانه‌تر است. شکست provider سهمیه رزروشده را برنمی‌گرداند و circuit breaker مشترک را تغذیه می‌کند؛ خرابی limiter نیز ارسال را fail-closed متوقف می‌کند.

در ورود Admin، شناسه‌های معتبر از نظر قالب همیشه پاسخ عمومی challenge‌شکل یکسان می‌گیرند. شناسه ناشناخته از limiter سخت‌گیرانه Admin عبور می‌کند و فقط محاسبه رمزنگاری decoy انجام می‌دهد؛ هیچ پیامک، challenge پایدار، حساب یا session برای آن ساخته نمی‌شود. خطاهای provider، cooldown و verification نیز وجود حساب را در پیام یا redirect آشکار نمی‌کنند.

`AUTH_TRUSTED_PROXY_HOPS` باید دقیقاً با تعداد reverse proxyهای مورد اعتماد بین کاربر و برنامه برابر باشد. برنامه IP را از مرز سمت راست `X-Forwarded-For` انتخاب و مقادیر سمت چپ را نادیده می‌گیرد. مبدأ برنامه باید فقط از ingress مورد اعتماد Runflare قابل دسترسی باشد و ingress باید IP اتصال را به header اضافه کند؛ در غیر این صورت هیچ تنظیم نرم‌افزاری نمی‌تواند header ارسالی مستقیم کاربر را قابل اعتماد کند.

مستندات عمومی Runflare در حال حاضر تعداد hop یا قرارداد دقیق `X-Forwarded-For` را
مشخص نمی‌کند؛ مقدار `1` نباید صرفاً براساس نمونه تنظیم شود. تا دریافت قرارداد رسمی،
`OTP_IP_RATE_LIMIT_ENABLED=false` است و `X-Forwarded-For` و `X-Real-IP` اصلاً وارد تصمیم
امنیتی نمی‌شوند. limiter اجباری PostgreSQL مستقل از IP باقی می‌ماند. پس از تأیید ingress،
IP protection و hop count هم‌زمان فعال شوند؛ ناسازگاری این لایه به‌صورت fail-closed عمل
می‌کند و هیچ IP خامی log نمی‌شود.

## آزمون عملیاتی

1. secret افشاشده قبلی را در پنل rotate کنید. فقط endpoint جدید و کامل native OTP را در secretهای Runflare تنظیم کنید؛ آن را در ticket، chat یا log قرار ندهید. startup موفق فقط اعتبارسنجی config است.
2. migration `0017_glorious_gravity.sql` را پس از کل زنجیره قبلی و بازبینی دستی اجرا کنید.
3. متغیرها را فقط در secretهای Runflare تنظیم، تعداد proxy hop را با زیرساخت تأیید و deployment را restart کنید.
4. برای شماره‌های کنترل‌شده، جداگانه بررسی کنید: log با outcome برابر `accepted` (پذیرش API)، وضعیت delivery همان `recId` در پنل (تحویل handset)، و در پایان verification موفق OTP. سپس ورود موبایلی Employer و Candidate و Admin از قبل ایجادشده را آزمایش کنید.
5. cooldown یک‌دقیقه‌ای، سهمیه‌های identifier/account/global، circuit breaker، انقضای ده‌دقیقه‌ای، سقف پنج تلاش، یک‌بارمصرف بودن و باطل شدن کد قدیمی پس از resend را بررسی کنید؛ IP فقط پس از تأیید ingress آزموده شود.
6. لاگ‌ها و bundle مرورگر را از نبود شماره، IP، OTP و endpoint بازبینی کنید.

OTP ایمیلی SMTP نیز از bucketهای مستقل channel و همان کنترل‌های اجباری PostgreSQL استفاده می‌کند. cooldown با قفل advisory و داده challenge در PostgreSQL اعمال می‌شود و limiter حافظه‌ای یا وابستگی Redis اضافه نشده است.
