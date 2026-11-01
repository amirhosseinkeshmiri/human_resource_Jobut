# Bootstrap مالک پلتفرم

این ابزار فقط بعد از اعمال دستی migration `0018` و فقط یک بار قابل اجرا است. ابزار در startup، prestart، build، login یا deployment فراخوانی نمی‌شود و API عمومی ندارد.

## پیش‌نیازهای دستی

1. اپراتور مجاز باید در یک محیط عملیاتی از پیش احرازشده و تحت کنترل سازمان اجرا کند. وجود flag یا برابری ایمیل، هویت اپراتور یا مالک را اثبات نمی‌کند.
2. دسترسی ترمینال یا اجرای one-off command در Runflare باید مستقلاً از پشتیبانی یا مستندات جاری Runflare تأیید شود. اگر این قابلیت تأیید نشده است، دستور را در Runflare حدس نزنید؛ از یک محیط مدیریتی کنترل‌شده با اتصال مجاز PostgreSQL استفاده کنید.
3. قبل از اجرا، اپراتور باید کنترل واقعی حساب هدف را مستقلاً تأیید کند؛ مثلاً ورود OTP موفق توسط مالک موردنظر در یک نشست کنترل‌شده و تطبیق UUID حساب از یک منبع مدیریتی معتبر. OTP، token یا credential نباید در argument، reference یا log ثبت شود.
4. از PostgreSQL backup معتبر و قابل‌بازیابی اطمینان حاصل شود و UUID حساب موجود و فعال به‌صورت مستقل بازبینی شود.
5. `DATABASE_URL` باید فقط در محیط امن process تنظیم شود و هرگز در command line، log یا ticket نوشته نشود.

## اجرای کنترل‌شده

```bash
npm run admin:bootstrap-owner -- \
  --admin-account-id "<EXISTING_ADMIN_UUID>" \
  --expected-email "amir.h6334@gmail.com" \
  --operator-reference "<NON_SENSITIVE_OPERATOR_REFERENCE>" \
  --authorization-reference "<APPROVED_CHANGE_OR_AUTHORIZATION_REFERENCE>" \
  --identity-verification-reference "<NON_SENSITIVE_IDENTITY_CHECK_REFERENCE>" \
  --confirm "PROVISION_JOBUT_PLATFORM_OWNER"
```

Referenceها فقط می‌توانند شناسه‌های ticket-like شامل حروف، اعداد و نویسه‌های `._:/-` باشند و نباید شامل ایمیل، شماره همراه، OTP، token، password، credential، متن کامل پرونده شخصی، secret یا توالی شش‌رقمی باشند.

ابزار transaction واحد و advisory lock می‌گیرد، نبود owner قبلی را بررسی می‌کند، حساب را با `FOR UPDATE` قفل می‌کند، status و ایمیل normalized را تطبیق می‌دهد، owner را درج می‌کند، sessionهای موجود آن حساب را باطل می‌کند و audit sanitized را در همان transaction می‌نویسد. اجرای مجدد بدون تغییر owner قبلی شکست می‌خورد.
