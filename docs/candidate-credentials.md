# گواهی‌ها، دوره‌ها و مدارک پشتیبان کارجو

این قابلیت با `CANDIDATE_CREDENTIALS_ENABLED=false` به‌صورت پیش‌فرض غیرفعال است. در حالت خاموش،
صفحات رزومه، PDF، ثبت درخواست و نمایش snapshot هیچ queryای به جدول‌های migration جدید اجرا نمی‌کنند.

رکوردهای ساختاریافته شامل گواهی حرفه‌ای، دوره آموزشی و مدرک تکمیلی هستند. تحصیلات رسمی همچنان فقط
در جدول‌های موجود تحصیلات رزومه نگهداری می‌شود. برای درخواست‌های جدیدی که پس از فعال‌سازی ارسال می‌شوند،
یک snapshot مستقل از metadata گواهی‌ها ثبت می‌شود؛ ویرایش بعدی رزومه snapshot را تغییر نمی‌دهد.

فایل پشتیبان اختیاری، خصوصی و فقط برای Candidate مالک قابل دریافت است. نسخه فعلی فقط JPEG، PNG و WebP
را پس از decode و تبدیل مجدد به WebP می‌پذیرد. PDF پذیرفته نمی‌شود، زیرا پروژه parser/validator امن PDF
ندارد. بایت فایل پشتیبان وارد PDF رزومه یا snapshot درخواست نمی‌شود.

## فعال‌سازی

1. از PostgreSQL نسخه پشتیبان تهیه و بازیابی آن را مستقل بررسی کنید.
2. migration `0025_windy_skreet.sql` را بعد از migration `0024` با فرایند دستی مصوب اعمال کنید.
3. وجود enum، سه جدول، foreign keyها، checkها و indexها را با query فقط‌خواندنی بررسی کنید.
4. کد جدید را ابتدا با `CANDIDATE_CREDENTIALS_ENABLED=false` استقرار و health check کنید.
5. writable بودن و فضای آزاد mount پایدار `/app/uploads` را بررسی کنید.
6. `CANDIDATE_CREDENTIALS_ENABLED=true` را تنظیم و برنامه را restart کنید. `prestart` باید زیرشاخه
   `/app/uploads/candidate-credentials`، عدم symlink و قابلیت نوشتن را تأیید کند.
7. create/edit/delete، upload/replace/delete تصویر، دسترسی خصوصی، PDF و snapshot درخواست جدید را با
   حساب‌های آزمایشی smoke test کنید.
