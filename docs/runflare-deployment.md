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
- `UPLOAD_STORAGE_DIR=/app/uploads`
- `SEP_TERMINAL_ID`
- `SEP_CALLBACK_URL`
- `SMS_PROVIDER=melipayamak`
- `MELIPAYAMAK_SENDING_MODE=native_otp`
- `EMAIL_PROVIDER` (`smtp`)
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_TIMEOUT_MS`
- `MELIPAYAMAK_OTP_ENDPOINT` (endpoint کامل، rotate‌شده و محرمانه HTTPS صادرشده از پنل با مسیر `/api/send/otp/...`)
- `SMS_TIMEOUT_MS` (عدد صحیح بین `1000` و `15000`؛ مقدار پیشنهادی `5000`)
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

## دیسک پایدار تصاویر

در پنل Runflare برای application با نام `jobut` یک Persistent Disk با ظرفیت ۲ GB
بسازید/متصل کنید و mount path را دقیقاً `/app/uploads` قرار دهید. سپس متغیر runtime
`UPLOAD_STORAGE_DIR=/app/uploads` را ثبت کنید. این مسیر نباید به `public/`، `.next/`،
`/tmp` یا مسیر سورس اشاره کند و نباید symlink باشد. volume باید در runtime (نه فقط
مرحله build) روی تمام replicaهایی که upload یا serve انجام می‌دهند mount باشد؛ اگر
Runflare یک volume را فقط به یک instance متصل می‌کند، تعداد replicaهای این سرویس باید
با همان محدودیت سازگار تنظیم شود.

فرمان start پروژه، پیش از آغاز Next.js، وجود مسیر، دسترسی خواندن/نوشتن و فضای آزاد
را بررسی می‌کند. probe با نام تصادفی و `O_EXCL` ساخته و بلافاصله حذف می‌شود و هیچ فایل
موجودی تغییر نمی‌کند. در نبود mount، permission نامناسب یا فضای آزاد کمتر از ۵ MiB،
سرویس fail-closed شروع نمی‌شود. خروجی موفق یک JSON با event
`production_runtime_verified` و `availableBytes` است؛ secret یا نام فایل‌ها log
نمی‌شوند. زیرشاخه `company-media` در startup با permission محدود ساخته یا بررسی می‌شود
و probe نوشتن نیز داخل همین زیرشاخه انجام می‌شود.

در تنظیمات application، Start Command باید دقیقاً `npm run start` (یا `npm start`)
باشد. npm در هر دو حالت lifecycle مربوط به `prestart` را اجرا می‌کند؛ اجرای مستقیم
`next start` یا یک فرمان سفارشی دیگر این guard را دور می‌زند. مستندات عمومی Runflare
امکان start/restart و مشاهده log را بیان می‌کند، اما فرمان واقعی application را تضمین
نمی‌کند؛ بنابراین مقدار Start Command باید در پنل خود application بازبینی شود و وجود
event برابر `production_runtime_verified` در log هر boot معیار قطعی اجرای guard است.

ستون‌های موجود `companies.logo_url` و `company_images.image_url` حفظ شده‌اند و اکنون
URLهایی مانند `/api/images/company-media/<random-name>.png` نگه می‌دارند؛ بنابراین
migration پایگاه داده لازم نیست. URLهای قدیمی بدون تغییر باقی می‌مانند و تا زمانی که
منبع قبلی‌شان موجود باشد backward-compatible هستند. فایل‌های موجود production نباید
دستی جابه‌جا یا حذف شوند.

### ترتیب استقرار دستی

1. پیش از deploy، disk دو گیگابایتی را mount و environment بالا را ثبت کنید.
2. release را با همان Install/Build/Start Commandهای ابتدای سند بسازید؛ migration
   جدیدی برای این تغییر اجرا نکنید.
3. log آغاز سرویس را برای event موفق و مقدار منطقی `availableBytes` بررسی کنید. مقدار
   نزدیک به ظرفیت ۲ GB (با کسر overhead filesystem) انتظار می‌رود.

   ```bash
   findmnt -T /app/uploads
   test -d /app/uploads/company-media -a -r /app/uploads/company-media -a -w /app/uploads/company-media
   df -h /app/uploads
   ```

   `findmnt` باید volume مورد انتظار را نشان دهد؛ صرف وجود یک directory هم‌نام برای
   اثبات persistent بودن کافی نیست. JSON موفق startup علاوه بر `availableBytes`، مقدار
   `totalBytes` را نیز برای تطبیق تقریبی با disk دو گیگابایتی گزارش می‌کند.
4. با حساب کارفرمای آزمایشی وارد `/employer/onboarding` شوید؛ لوگوی مربع PNG/JPEG
   زیر ۵ MB بفرستید و ذخیره موفق و نمایش لوگو در داشبورد/صفحه آگهی را بررسی کنید.
5. حداکثر شش تصویر گالری بفرستید. پاسخ URL تصویر باید `200`، `Content-Type` درست،
   `X-Content-Type-Options: nosniff` و cache immutable داشته باشد. یک نام ساختگی یا
   traversal باید `404` بدهد.
6. لوگوی دیگری انتخاب و ذخیره کنید؛ URL باید عوض شود و تصویر جدید نمایش داده شود.
   برای حذف گالری، گزینه «حذف همه تصاویر فعلی گالری» را انتخاب کنید. پس از commit
   دیتابیس، فایل‌های superseded پاک می‌شوند؛ فایل قبلی پیش از commit حذف نمی‌شود.
7. application را restart کنید و همان URL جدید را دوباره با `curl -I`/مرورگر بررسی
   کنید. سپس یک redeploy بدون حذف volume انجام دهید و همان بررسی را تکرار کنید؛ URL و
   محتوا باید همچنان در دسترس باشند.
8. برای کنترل ظرفیت، log startup و dashboard دیسک Runflare را بررسی کنید. رخدادهای
   `ENOSPC`، permission و validation با eventهای ساختاریافته و بدون داده حساس ثبت
   می‌شوند.

نمونه smoke test پس از داشتن URL واقعی:

```bash
curl -fsSI 'https://www.jobut.ir/api/images/company-media/<filename>'
curl -sS -o /dev/null -w '%{http_code}\n' \
  'https://www.jobut.ir/api/images/company-media/../../etc/passwd'
```

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

