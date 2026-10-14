-- One review-only preview posting for the public jobs UI.
-- The fixed identifiers and conflict handling keep this migration safe to retry.
INSERT INTO "industries" ("id", "name", "slug")
VALUES (
	'9a3a7288-6c82-4c4d-9b28-38a2cb2bd111',
	'نرم‌افزار و فناوری اطلاعات',
	'software-it'
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "employer_accounts" ("id", "email")
VALUES (
	'9a3a7288-6c82-4c4d-9b28-38a2cb2bd112',
	'preview-employer@jobut.invalid'
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "companies" (
	"id",
	"employer_account_id",
	"industry_id",
	"name",
	"address",
	"founding_year"
)
SELECT
	'9a3a7288-6c82-4c4d-9b28-38a2cb2bd113',
	employer."id",
	industry."id",
	'شرکت نمونه فناوری آکادمیک (نمایشی)',
	'تهران، منطقه نوآوری و فناوری',
	1400
FROM (
	SELECT "id"
	FROM "employer_accounts"
	WHERE "email" = 'preview-employer@jobut.invalid'
	LIMIT 1
) AS employer
CROSS JOIN (
	SELECT "id"
	FROM "industries"
	WHERE "slug" = 'software-it'
		OR "name" = 'نرم‌افزار و فناوری اطلاعات'
	ORDER BY CASE WHEN "slug" = 'software-it' THEN 0 ELSE 1 END
	LIMIT 1
) AS industry
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "job_posts" (
	"id",
	"company_id",
	"title",
	"status",
	"workplace_type",
	"employment_type",
	"location",
	"seniority_level",
	"salary_min",
	"salary_max",
	"salary_negotiable",
	"required_skills",
	"description",
	"published_at",
	"expires_at"
)
SELECT
	'9a3a7288-6c82-4c4d-9b28-38a2cb2bd114',
	company."id",
	'توسعه‌دهنده ارشد نرم‌افزار (آگهی نمایشی)',
	'published',
	'hybrid',
	'full_time',
	'تهران',
	'senior',
	NULL,
	NULL,
	true,
	ARRAY['TypeScript', 'React', 'حل مسئله', 'کار تیمی']::text[],
	'<p>برای توسعه محصولات دیجیتال خود به همکاری یک توسعه‌دهنده ارشد نرم‌افزار با تجربه ساخت سامانه‌های قابل اتکا نیاز داریم.</p><p><strong>مسئولیت‌ها:</strong></p><ul><li>طراحی و پیاده‌سازی قابلیت‌های محصول</li><li>همکاری با تیم محصول و بازبینی فنی کد</li><li>بهبود کیفیت، کارایی و نگهداشت‌پذیری سامانه</li></ul><p>این موقعیت صرفاً برای پیش‌نمایش رابط عمومی آگهی‌ها ایجاد شده است.</p>',
	now(),
	now() + interval '30 days'
FROM "companies" AS company
INNER JOIN "employer_accounts" AS employer
	ON employer."id" = company."employer_account_id"
WHERE employer."email" = 'preview-employer@jobut.invalid'
LIMIT 1
ON CONFLICT DO NOTHING;
