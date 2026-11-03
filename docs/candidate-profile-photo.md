# تصویر پروفایل کارجو

این قابلیت به‌صورت پیش‌فرض غیرفعال است و تصویر را به شکل WebP بدون metadata در زیرشاخه
`candidate-profile-photos` از مسیر `UPLOAD_STORAGE_DIR` نگه می‌دارد. در تولید JobUT مسیر کامل
`/app/uploads/candidate-profile-photos` خواهد بود؛ مسیر مطلق در دیتابیس ذخیره نمی‌شود.

## فعال‌سازی امن

1. نسخه‌ای از PostgreSQL را پشتیبان‌گیری و قابلیت بازیابی آن را مستقل بررسی کنید.
2. migration `0024_outgoing_crusher_hogan.sql` را با فرایند دستی مصوب روی PostgreSQL اعمال کنید.
3. با SQL فقط‌خواندنی، وجود جدول و constraintهای آن را بررسی کنید.
4. کد به‌روز را با `CANDIDATE_PROFILE_PHOTO_ENABLED=false` استقرار دهید و health/startup را بررسی کنید.
5. مالکیت و writable بودن mount پایدار `/app/uploads` و ظرفیت آزاد آن را بررسی کنید.
6. `CANDIDATE_PROFILE_PHOTO_ENABLED=true` را تنظیم و برنامه را restart کنید. `prestart` باید زیرشاخه
   موردنیاز، عدم symlink، قابلیت نوشتن و ظرفیت آزاد mount را تأیید کند.
7. با یک حساب آزمایشی کارجو، upload، replace، display، delete و ماندگاری پس از restart/redeploy را
   smoke test کنید. دسترسی بدون session و با session کارفرما باید `401`/`404` برگرداند.

تا پیش از تکمیل گام 2 نباید feature flag فعال شود؛ در حالت غیرفعال هیچ queryای به جدول جدید اجرا نمی‌شود.
