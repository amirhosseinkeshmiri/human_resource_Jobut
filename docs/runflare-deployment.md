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
- `MELIPAYAMAK_SHARED_ENDPOINT`
- `MELIPAYAMAK_BODY_ID`
- `SMS_TIMEOUT_MS`
- `AUTH_TRUSTED_PROXY_HOPS`
- `SMS_RATE_LIMIT_IDENTIFIER_MAX`
- `SMS_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS`
- `SMS_RATE_LIMIT_IP_MAX`
- `SMS_RATE_LIMIT_IP_WINDOW_SECONDS`
- `SMS_RATE_LIMIT_GLOBAL_MAX`
- `SMS_RATE_LIMIT_GLOBAL_WINDOW_SECONDS`
- `SMS_RATE_LIMIT_ADMIN_IDENTIFIER_MAX`
- `SMS_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS`
- `SMS_RATE_LIMIT_ADMIN_IP_MAX`
- `SMS_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS`

فعال‌سازی `ENABLE_HSTS=true` فقط پس از تأیید HTTPS و redirect دائمی HTTP به HTTPS
انجام شود. تعداد `AUTH_TRUSTED_PROXY_HOPS` نیز باید با زنجیره واقعی proxyهای Runflare
تطبیق داده شود.

