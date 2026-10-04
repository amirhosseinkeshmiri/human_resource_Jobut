# Jobut

Employer-side foundation for Jobut, built with Next.js, TypeScript, Tailwind CSS,
PostgreSQL, and Drizzle ORM.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`DATABASE_URL` must contain a PostgreSQL connection string. `AUTH_SECRET` must
be a private random value of at least 32 characters and must be identical across
all application instances.

Verification-code delivery is intentionally unavailable in production until an
email/SMS provider is selected. In local development only, the generated code is
shown in the login UI so the flow can be exercised without a delivery provider.

Company image uploads are likewise local-development only and are ignored by
Git. Production onboarding requires a persistent storage provider before new
logo or gallery files can be saved.

```bash
npm run db:generate  # generate SQL migrations from the schema
npm run db:migrate   # apply pending migrations
npm run db:seed      # seed industry reference data
```
