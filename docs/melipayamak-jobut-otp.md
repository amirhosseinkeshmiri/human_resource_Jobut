# پیامک OTP اختصاصی Jobut

در production، ورود موبایلی Employer، Candidate و Adminهای از قبل ایجادشده از endpoint اختصاصی Jobut در MeliPayamak استفاده می‌کند. این endpoint و متن پیامک باید مستقل از هر محصول دیگر باشند و نباید در کد، مرورگر یا لاگ قرار بگیرند.

## قرارداد

- درخواست: `POST` با JSON دقیق `{ "to": "09123456789" }`
- پاسخ موفق: JSON دقیقاً دارای `code` شش‌رقمی ASCII، مانند `{ "code": "123456" }`
- متن، فرستنده، template ID، API key و OTP در درخواست Jobut ارسال نمی‌شوند.

کد را provider تولید می‌کند. Jobut ابتدا challenge منقضی و غیرقابل‌استفاده رزرو می‌کند، درخواست شبکه را بیرون تراکنش می‌فرستد و فقط HMAC کد را در مرحله فعال‌سازی ذخیره می‌کند. OTP خام نه ذخیره و نه لاگ می‌شود.

## متغیرهای production

```text
SMS_PROVIDER=melipayamak
MELIPAYAMAK_JOBUT_OTP_ENDPOINT=<dedicated secret Jobut endpoint>
SMS_TIMEOUT_MS=5000
APP_URL=https://www.jobut.ir
```

endpoint باید HTTPS، بدون redirect/query/fragment/URL credentials، روی hostname دقیق `console.melipayamak.com` و پورت استاندارد باشد. `AUTH_SECRET` موجود برای HMAC استفاده می‌شود.

## آزمون عملیاتی

1. endpoint جدید Jobut را با template فارسی اختصاصی و تولید همیشگی کد شش‌رقمی ایجاد کنید.
2. متغیرها را فقط در secretهای Runflare تنظیم و deployment را restart کنید.
3. برای شماره‌های کنترل‌شده، ورود موبایلی Employer و Candidate و سپس Admin از قبل ایجادشده را آزمایش کنید.
4. cooldown یک‌دقیقه‌ای، انقضای ده‌دقیقه‌ای، سقف پنج تلاش، یک‌بارمصرف بودن و باطل شدن کد قدیمی پس از resend را بررسی کنید.
5. لاگ‌ها و bundle مرورگر را از نبود شماره، OTP و endpoint بازبینی کنید.

ارسال ایمیل خارج از این integration است و همچنان provider تولیدی ندارد. cooldown با قفل advisory و داده challenge در PostgreSQL اعمال می‌شود و limiter حافظه‌ای یا وابستگی Redis اضافه نشده است.
