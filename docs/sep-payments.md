# پرداخت SEP

`PackagePurchase` سفارش تجاری و `PaymentAttempt` هر تلاش مستقل درگاه است. مبلغ snapshot بسته با واحد تومان، فقط در سرور و دقیقاً یک‌بار در ۱۰ ضرب و به‌صورت ریال روی تلاش پرداخت ثبت می‌شود. callback تا پیش از تطبیق مبلغ و تأیید server-to-server بانک، اثبات پرداخت نیست. تأیید تلاش، پرداخت خرید و تخصیص یکتای اعتبار در یک تراکنش انجام می‌شوند.

## وضعیت و ایمنی تلاش پرداخت

- `created`، `redirect_ready` و `reconciliation_required` همگی تلاش حل‌نشده‌اند و بدون محدودیت زمانی، ایجاد token جدید برای همان خرید را مسدود می‌کنند. طول عمر token سامان مستند و تأیید نشده است؛ بنابراین گذشت زمان به‌تنهایی مجوز retry نیست.
- timeout، خطای شبکه/HTTP یا پاسخ نامعتبر هنگام ایجاد token یا verify، callback ناسازگار و شکست نامطمئن finalization به `reconciliation_required` می‌روند و شکست قطعی تلقی نمی‌شوند. ممکن است SEP درخواست token را پذیرفته باشد ولی پاسخ معتبر به برنامه نرسیده باشد.
- فقط رد صریح server-to-server توسط SEP یا callback غیرموفق قطعی، تلاش عادی را `failed`/`canceled` می‌کند. callback غیرموفق دیررس، تلاش `reconciliation_required` را downgrade نمی‌کند.
- callback موفق دیررس برای تلاش `failed` یا `canceled` همچنان verify سمت سرور را اجرا می‌کند تا پرداخت معتبر از دست نرود.
- اگر دو `RefNum` متفاوت برای یک خرید واقعاً verify شوند، هر دو تلاش با وضعیت `verified` حفظ می‌شوند؛ تلاش دوم `failure_category=duplicate_settlement` می‌گیرد و نتیجه برای بررسی اپراتور است. تخصیص اعتبار خرید به‌علت constraint و تراکنش موجود فقط یک بار انجام می‌شود.
- اپراتور نباید وضعیت مبهم را دستی `failed` کند، اعتبار دوم بدهد یا refund خودکار انجام دهد. ابتدا باید settlement/reference در پنل یا کانال رسمی SEP بررسی و نتیجه در فرایند reconciliation آینده ثبت شود.

## تنظیمات اجرا

- `APP_URL`: مبدأ عمومی و canonical برنامه؛ در production برابر `https://www.jobut.ir`
- `SEP_TERMINAL_ID`: شناسه ترمینال، فقط سمت سرور
- `SEP_CALLBACK_URL`: دقیقاً `https://www.jobut.ir/api/payments/sep/callback`

شماره همراه ذخیره‌شده کارفرما در صورت وجود به SEP ارسال می‌شود. قرارداد مبنای پروژه `CellNumber` را اختیاری در نظر می‌گیرد؛ برای کارفرمای email-only مقدار ساختگی ارسال نمی‌شود. اگر قرارداد merchant حساب Jobut آن را اجباری می‌داند، باید پیش از live شدن با SEP تأیید شود.

## چک‌لیست production

1. migration جدید را پس از بازبینی دستی اجرا کنید.
2. سه متغیر بالا را با HTTPS و بدون query/fragment تنظیم کنید.
3. callback دقیق را در پنل SEP ثبت و دسترسی POST عمومی آن را روی Runflare بررسی کنید.
4. یک پرداخت کم‌مبلغ تحت کنترل مالک انجام دهید؛ paid شدن خرید و تخصیص دقیقاً یک اعتبار ledger را بررسی کنید.
5. callback را تکرار/refresh کنید و عدم تخصیص دوباره اعتبار را بررسی کنید.
6. نتیجه را در Admin Sales و انتظار settlement را جداگانه با SEP کنترل کنید.

پس از migration `0026_payment_reconciliation.sql` و پیش از فعال‌سازی کد جدید، رکوردهای legacy حل‌نشده را با query فقط‌خواندنی بررسی کنید. migration فقط مقدار enum را اضافه می‌کند و هیچ رکورد تاریخی را بازطبقه‌بندی نمی‌کند.

```sql
select package_purchase_id, status, count(*) as attempts,
       min(created_at) as oldest, max(created_at) as newest
from payment_attempts
where status in ('created', 'redirect_ready')
group by package_purchase_id, status
order by oldest;
```

```sql
select package_purchase_id, count(*) as verified_attempts
from payment_attempts
where status = 'verified'
group by package_purchase_id
having count(*) > 1;
```

```sql
select p.id, p.status, count(c.id) as allocation_rows,
       coalesce(sum(c.amount), 0) as allocated_amount
from package_purchases p
left join company_job_credit_transactions c on c.package_purchase_id = p.id
where p.status = 'paid'
group by p.id, p.status, p.job_credits
having count(c.id) <> 1 or coalesce(sum(c.amount), 0) <> p.job_credits;
```

پاسخ verify در قرارداد موجود فقط با `ResultCode === 0` ارزیابی می‌شود و مبلغ authoritative قابل اتکایی مستند نشده است؛ بنابراین مبلغ callback با snapshot تلاش دقیقاً تطبیق داده می‌شود، اما کنترل مبلغ verify تا دریافت مستند merchant رسمی اضافه نشده است.
