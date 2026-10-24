# هدرهای امنیتی HTTP و CSP

## وضعیت فعلی

هدرهای `nosniff`، `Referrer-Policy: no-referrer`، `X-Frame-Options: DENY` و `Permissions-Policy` روی همه پاسخ‌ها enforce می‌شوند. مسیرهای احراز هویت‌شده، ورود و API پرداخت علاوه بر `Cache-Control: private, no-store` دارای `CDN-Cache-Control: no-store`، `Pragma: no-cache` و `Expires: 0` هستند.

CSP فعلاً با نام `Content-Security-Policy-Report-Only` ارسال می‌شود. policy عمداً فاقد `unsafe-inline` و `unsafe-eval` است. خروجی فعلی Next.js شامل inline bootstrap script است؛ enforce‌کردن مستقیم `script-src 'self'` بدون nonce/hash برنامه را از کار می‌اندازد.

## سازگاری SEP و احراز هویت

مرورگر پرداخت را از API هم‌مبدأ آغاز و سپس با `window.location.assign` به origin ثابت `https://sep.shaparak.ir` هدایت می‌کند؛ `connect-src 'self'` این جریان را مسدود نمی‌کند. فراخوانی token/verify سمت سرور است و تحت CSP مرورگر نیست. callback خارجی SEP نیز به API برنامه وارد می‌شود و پاسخ‌های آن `no-store` هستند. Server Actionها و OTP هم‌مبدأ باقی می‌مانند.

Cookieهای Employer، Candidate و Admin همچنان `HttpOnly`، `SameSite=Lax`، path ریشه، expiry صریح و در production دارای `Secure` هستند.

## HSTS روی Runflare

HSTS فقط وقتی ساخته می‌شود که build در production باشد و `ENABLE_HSTS=true` تنظیم شده باشد. پیش از فعال‌سازی باید روی دامنه نهایی Runflare موارد زیر تأیید شوند:

1. HTTPS معتبر و پایدار باشد.
2. HTTP همیشه به HTTPS همان دامنه redirect شود.
3. callback پرداخت و تمام دامنه‌های مورد استفاده روی HTTPS کار کنند.

مقدار فعلی فقط `max-age=31536000` است؛ `includeSubDomains` و `preload` عمداً فعال نیستند.

## ارتقای CSP به حالت enforce

حداقل یک release در Report-Only اجرا و violationهای صفحات عمومی، پنل‌ها، Server Actionها و پرداخت بررسی شود. سپس nonce per-request با `proxy.ts` و dynamic rendering برای مسیرهای لازم، یا hashهای پایدار در صورت تضمین ثبات build و Runflare، پیاده شود. پس از اعتبارسنجی نام هدر به `Content-Security-Policy` تغییر کند. originهای storage تصویر فقط پس از انتخاب provider و به‌صورت allowlist محدود اضافه شوند.

## rollback

در صورت ناسازگاری، تغییر `next.config.ts` rollback و redeploy شود. CSP فعلی Report-Only است و اجرای برنامه را مسدود نمی‌کند. خاموش‌کردن `ENABLE_HSTS` مانع ارسال‌های بعدی می‌شود، اما browser تا پایان `max-age` قبلی policy را حفظ می‌کند؛ به همین دلیل فعال‌سازی آن نیازمند تأیید HTTPS است.
