# اجرای امن تست‌های PostgreSQL

این workflow فقط پایگاه دقیق `jobut_test` روی loopback را می‌پذیرد و پیش و پس از migration هویت اتصال را بررسی می‌کند. از URL محیط production یا staging استفاده نکنید.

## اجرای محلی با Docker Compose

```bash
docker compose -f compose.integration.yml up -d --wait
INTEGRATION_TESTS=1 \
DATABASE_URL=postgresql://jobut_test:jobut_test@127.0.0.1:55432/jobut_test \
AUTH_SECRET=test-only-auth-secret-with-at-least-32-characters \
npm run test:integration:full
docker compose -f compose.integration.yml down -v
```

داده PostgreSQL روی `tmpfs` نگهداری می‌شود و با توقف container از بین می‌رود. دستور `test:integration:full` به‌ترتیب identity check، `db:check`، کل migration chain، identity check دوم و همه integration testها را اجرا می‌کند.

CI نیز از service container اختصاصی با database/user/password آزمایشی استفاده می‌کند و همین دستور را اجرا می‌کند. SMS و پرداخت واقعی در این workflow فراخوانی نمی‌شوند.
