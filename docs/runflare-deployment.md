# استقرار Jobut روی Runflare

تنظیمات سرویس متصل به GitHub باید به‌صورت زیر باشد:

| تنظیم | مقدار |
|---|---|
| Branch | `main` |
| Node.js | `24.22.1` یا نسخه سازگار با بازه `>=24.22.1 <25` |
| npm | `11.9.0` یا نسخه سازگار با بازه `>=11.9.0 <12` |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Start Command | `npm run start` |
| Build Engine | Webpack (`next build --webpack`) |

در محیط build و runtime مقدار `NODE_ENV` باید دقیقاً `production` باشد. مقدارهای
غیراستاندارد مانند `running` عمداً رد می‌شوند، زیرا در غیر این صورت کنترل‌های امنیتی
وابسته به production (cookie امن، محدودسازی OTP، اعتبارسنجی origin، SEP و HSTS)
فعال نخواهند شد. فرمان `npm run start` پیش از اجرای سرور، تنظیمات عمومی runtime را
به‌صورت fail-closed بررسی می‌کند.

Runflare نباید `next build` را مستقیماً اجرا کند؛ فرمان ثبت‌شده در `package.json`
باید مرجع build باشد. گزینه `--include=dev` نیز ضروری است، چون TypeScript، تعریف‌های
نوع و ESLint ابزارهای build هستند و عمداً در `devDependencies` نگهداری می‌شوند.

برای نخستین استقرار پس از تغییر تنظیمات، cache قبلی build پاک و deployment تازه از
commit موردنظر شاخه `main` ایجاد شود. پیش از استقرار، hash همان commit در Runflare و
GitHub با یکدیگر تطبیق داده شود.

## متغیرهای محیطی

نام متغیرهای مورد استفاده در production در ادامه آمده است. مقدار واقعی و secretها
فقط باید در تنظیمات محرمانه Runflare ذخیره شوند؛ مقادیر نمونه repository مناسب
production نیستند.

- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_URL`
- `ENABLE_HSTS`
- `SEP_TERMINAL_ID`
- `SEP_CALLBACK_URL`
- `SMS_PROVIDER`
- `EMAIL_PROVIDER` (`smtp`)
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_TIMEOUT_MS`
- `MELIPAYAMAK_SHARED_ENDPOINT`
- `MELIPAYAMAK_BODY_ID`
- `SMS_TIMEOUT_MS`
- `OTP_RATE_LIMIT_IDENTIFIER_MAX=3`
- `OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS=600`
- `OTP_RATE_LIMIT_ACCOUNT_MAX=3`
- `OTP_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS=600`
- `OTP_RATE_LIMIT_GLOBAL_MAX=100`
- `OTP_RATE_LIMIT_GLOBAL_WINDOW_SECONDS=60`
- `OTP_RATE_LIMIT_ADMIN_IDENTIFIER_MAX=2`
- `OTP_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS=900`
- `OTP_PROVIDER_CIRCUIT_FAILURE_MAX=5`
- `OTP_PROVIDER_CIRCUIT_WINDOW_SECONDS=300`
- `OTP_IP_RATE_LIMIT_ENABLED=false`

مقادیر عمومی canonical باید دقیقاً به‌شکل زیر تنظیم شوند:

- `APP_URL=https://www.jobut.ir`
- `SEP_CALLBACK_URL=https://www.jobut.ir/api/payments/sep/callback`

callback ثبت‌شده در پنل SEP نیز باید همین URL نهایی باشد و نباید برای رسیدن به دامنه
canonical به redirect متکی باشد.

فعال‌سازی `ENABLE_HSTS=true` فقط پس از تأیید HTTPS و redirect دائمی HTTP به HTTPS
انجام شود.

برای `AUTH_TRUSTED_PROXY_HOPS` مقدار نمونه یا حدسی استفاده نشود. تعداد proxyهای مورد
اعتماد که Runflare به سمت راست `X-Forwarded-For` اضافه می‌کند باید ابتدا با پشتیبانی
Runflare تأیید و سپس همان عدد صحیح بین ۱ تا ۱۰ در environment ثبت شود. تا آن زمان
`OTP_IP_RATE_LIMIT_ENABLED=false` باقی می‌ماند و نبود این مقدار مانع OTP نیست؛ limiterهای
اجباری شناسه، حساب و provider همچنان در PostgreSQL فعال‌اند. اگر IP limiter فعال شود،
runtime در نبود مقدار معتبر fail-closed شروع نمی‌شود. diagnostic امن فقط error code
و `forwardedChainLength` را ثبت می‌کند؛ این تعداد برای تأیید سازگاری مفید است ولی
به‌تنهایی اثبات تعداد hop مورد اعتماد نیست.

## تنظیمات دستی ingress در Runflare

این موارد خارج از repository هستند و باید در پنل Runflare اعمال و سپس با درخواست
واقعی بررسی شوند:

1. دامنه `www.jobut.ir` به‌عنوان دامنه canonical انتخاب شود.
2. تمام درخواست‌های HTTP برای دامنه‌های apex و `www` با redirect دائمی `308` و با
   حفظ path و query به `https://www.jobut.ir` هدایت شوند.
3. درخواست‌های HTTPS روی `jobut.ir` نیز با `308` و حفظ path و query به
   `https://www.jobut.ir` هدایت شوند.
4. TLS معتبر برای هر دو hostname برقرار باشد. فقط پس از تأیید این موارد، مقدار
   `ENABLE_HSTS=true` در build و runtime فعال شود؛ این پروژه عمداً HSTS preload و
   `includeSubDomains` را فعال نمی‌کند.
5. installation با `npm ci --include=dev` و بدون `--force` انجام شود و cache اولین
   deployment پس از تغییر dependencyها پاک شود.

برای rollback، deployment قبلی و مجموعه environment همان release نگهداری شود.
بازگشت باید اتمیک به image قبلی باشد؛ migration یا تغییر پایگاه داده‌ای در این
اصلاح وجود ندارد. در صورت مشاهده مشکل در headerها، ابتدا `ENABLE_HSTS` قابل بازگشت
است، اما `NODE_ENV=production`، HTTPS و redirect canonical نباید غیرفعال شوند.

