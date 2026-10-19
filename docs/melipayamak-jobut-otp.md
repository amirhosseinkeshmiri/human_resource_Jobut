# پیامک OTP اختصاصی Jobut

در production، ورود موبایلی Employer، Candidate و Adminهای از قبل ایجادشده از API ارسال ساده پیامک MeliPayamak استفاده می‌کند. endpoint شامل credential محرمانه در path است و نباید در کد، مرورگر، پاسخ خطا یا لاگ قرار بگیرد.

## قرارداد

- درخواست: `POST` با JSON دقیق `{ "from": "<sender>", "to": "09123456789", "text": "کد ورود به JOBUT: 123456" }`
- پاسخ معتبر: JSON دارای `recId` عددی و `status` متنی، مانند `{ "recId": 3741437414, "status": "" }`
- template ID، API key field یا property جداگانه برای OTP ارسال نمی‌شود.

کد شش‌رقمی را Jobut با random cryptographic تولید می‌کند. Jobut ابتدا challenge منقضی و غیرقابل‌استفاده رزرو می‌کند، OTP خام را فقط در متن درخواست شبکه می‌فرستد و پس از پاسخ معتبر provider فقط HMAC کد را در مرحله فعال‌سازی ذخیره می‌کند. OTP خام نه persist و نه log می‌شود.

## متغیرهای production

```text
SMS_PROVIDER=melipayamak
MELIPAYAMAK_SIMPLE_ENDPOINT=<secret full send/simple endpoint>
MELIPAYAMAK_FROM=<active sender number>
SMS_TIMEOUT_MS=5000
APP_URL=https://www.jobut.ir
```

endpoint باید HTTPS، بدون redirect/query/fragment/URL credentials، روی hostname دقیق `console.melipayamak.com` و پورت استاندارد باشد. `AUTH_SECRET` موجود برای HMAC استفاده می‌شود.

## آزمون عملیاتی

1. endpoint کامل و محرمانه send/simple و شماره فرستنده فعال را از پنل MeliPayamak دریافت کنید.
2. متغیرها را فقط در secretهای Runflare تنظیم و deployment را restart کنید.
3. برای شماره‌های کنترل‌شده، ورود موبایلی Employer و Candidate و سپس Admin از قبل ایجادشده را آزمایش کنید.
4. cooldown یک‌دقیقه‌ای، انقضای ده‌دقیقه‌ای، سقف پنج تلاش، یک‌بارمصرف بودن و باطل شدن کد قدیمی پس از resend را بررسی کنید.
5. لاگ‌ها و bundle مرورگر را از نبود شماره، OTP و endpoint بازبینی کنید.

ارسال ایمیل خارج از این integration است و همچنان provider تولیدی ندارد. cooldown با قفل advisory و داده challenge در PostgreSQL اعمال می‌شود و limiter حافظه‌ای یا وابستگی Redis اضافه نشده است.
