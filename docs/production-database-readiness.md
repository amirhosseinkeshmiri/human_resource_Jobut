# آمادگی migration پایگاه داده production

این سند وضعیت **مخزن** را توضیح می‌دهد و وضعیت production را اثبات نمی‌کند. اسکریپت
`scripts/verify-production-migrations-readonly.sql` باید توسط مالک محصول در pgAdmin اجرا و خروجی آن
با migrationهای زیر تطبیق داده شود. اسکریپت فقط catalogها و journal را می‌خواند و داده کاربر را نمی‌خواند.

## ترتیب و وابستگی‌ها

زنجیره Drizzle بدون شکاف از `0000` تا `0025` در `_journal.json` ثبت شده است. migrationها باید به همین
ترتیب تعیین تکلیف شوند؛ وجود یک جدول به‌تنهایی به معنی ثبت migration متناظر در journal نیست.

| migration | قابلیت/تغییر | وابستگی مستقیم مهم |
|---|---|---|
| `0013_regular_silvermane.sql` | `candidate_job_preferences` | `candidate_accounts` و enumهای `workplace_type`، `employment_type` و `seniority_level` |
| `0019_bizarre_power_man.sql` | پذیرش نسخه‌دار اسناد حقوقی | `candidate_accounts` |
| `0020_wise_phalanx.sql` | درخواست داده/حذف حساب و تاریخچه وضعیت | `candidate_accounts`؛ جدول event به جدول request وابسته است |
| `0021_curved_the_professor.sql` | اعلان تغییر وضعیت درخواست | `candidate_accounts` و `job_application_status_history` |
| `0022_mute_warpath.sql` | آگهی‌های ذخیره‌شده | `candidate_accounts` و `job_posts` |
| `0023_messy_fabian_cortez.sql` | افزودن `withdrawn` به `application_status` | enum ساخته‌شده در `0010` |
| `0024_outgoing_crusher_hogan.sql` | عکس پروفایل Candidate | `candidate_accounts` و volume قابل‌نوشتن `/app/uploads` |
| `0025_windy_skreet.sql` | مدارک، فایل خصوصی و snapshot مدارک | `candidate_accounts` و `application_resume_snapshots` از `0015`؛ volume `/app/uploads` |

`0014` تا `0018` نیز باید پیش از `0019` تعیین تکلیف شده باشند. به‌طور خاص `0018` بنیاد RBAC است، هرچند
featureهای Candidate بالا از جدول‌های آن استفاده نمی‌کنند.

## ماتریس فعال‌سازی

| قابلیت | migration | flag | مقدار امن | شرط فعال‌سازی |
|---|---|---|---|---|
| پذیرش حقوقی | `0019` | `CANDIDATE_LEGAL_ACCEPTANCE_ENABLED` | `false` | جدول و constraintها تأیید شوند، کد جدید deploy شود و `LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE` فقط پس از تأیید واقعی متن حقوقی `true` شود |
| درخواست داده/حذف | `0020` | `CANDIDATE_DATA_REQUESTS_ENABLED` | `false` | هر دو جدول، هر دو enum، FKها، checkها و partial unique index تأیید شوند |
| اعلان درخواست | `0021` | `CANDIDATE_APPLICATION_NOTIFICATIONS_ENABLED` | `false` | جدول، unique روی history، FKها و indexها تأیید شوند |
| Saved Jobs | `0022` | `CANDIDATE_SAVED_JOBS_ENABLED` | `false` | جدول، composite PK، دو FK و indexها تأیید شوند |
| انصراف Candidate | `0023` | `CANDIDATE_APPLICATION_WITHDRAWAL_ENABLED` | `false` | وجود label دقیق `withdrawn` در enum تأیید شود |
| عکس پروفایل | `0024` | `CANDIDATE_PROFILE_PHOTO_ENABLED` | `false` | جدول/constraintها، کد deployشده و mount و زیرشاخه storage تأیید شوند |
| مدارک Candidate | `0025` | `CANDIDATE_CREDENTIALS_ENABLED` | `false` | سه جدول، enum، FK/index/checkها، کد deployشده و storage خصوصی تأیید شوند |

پیشنهاد شغلی flag جدید ندارد و به ساختار سالم `candidate_job_preferences` از `0013` وابسته است.

## تصمیم درباره repair دستی 0013

ساخت دستی جدول، journal را خودکار همگام نمی‌کند. ابتدا خروجی catalog و journal را بگیرید:

- اگر hash migration `0013` ثبت و ساختار دقیقاً منطبق است، repair ساختاری انجام شده و journal احتمالاً از قبل ثبت بوده است.
- اگر ساختار منطبق ولی hash ثبت نیست، **هیچ INSERT دستی و کور به journal انجام ندهید**. قبل از reconciliation، خروجی کامل
  journal، hash بالا و تاریخچه اجرای production باید توسط اپراتور پایگاه داده بررسی شود.
- اگر ساختار ناقص است، flagهای وابسته خاموش بمانند و تفاوت دقیق constraint/column جداگانه اصلاح شود؛ اجرای مجدد کور
  migration `0013` روی جدول موجود امن نیست.

Rollback کد، schema را برنمی‌گرداند. بازگردانی schema/data فقط با رویه مستقل backup/restore و پس از تأیید اپراتور انجام می‌شود.
