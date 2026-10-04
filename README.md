# Jobut

Employer-side foundation for Jobut, built with Next.js, TypeScript, Tailwind CSS,
PostgreSQL, and Drizzle ORM.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`DATABASE_URL` must contain a PostgreSQL connection string.

```bash
npm run db:generate  # generate SQL migrations from the schema
npm run db:migrate   # apply pending migrations
npm run db:seed      # seed industry reference data
```
