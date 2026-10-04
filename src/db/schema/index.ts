import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const employerAccounts = pgTable(
  "employer_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).unique(),
    mobile: varchar("mobile", { length: 20 }).unique(),
    ...timestamps,
  },
  (table) => [
    check(
      "employer_accounts_contact_check",
      sql`${table.email} is not null or ${table.mobile} is not null`,
    ),
  ],
);

export const employerIdentifierType = pgEnum("employer_identifier_type", ["email", "mobile"]);

export const employerAuthChallenges = pgTable(
  "employer_auth_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: varchar("identifier", { length: 320 }).notNull(),
    identifierType: employerIdentifierType("identifier_type").notNull(),
    codeDigest: varchar("code_digest", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("employer_auth_challenges_identifier_idx").on(table.identifier),
    check(
      "employer_auth_challenges_attempts_check",
      sql`${table.attempts} between 0 and 5`,
    ),
  ],
);

export const employerSessions = pgTable(
  "employer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employerAccountId: uuid("employer_account_id")
      .notNull()
      .references(() => employerAccounts.id, { onDelete: "cascade" }),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("employer_sessions_account_id_idx").on(table.employerAccountId)],
);

export const industries = pgTable("industries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  ...timestamps,
});

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employerAccountId: uuid("employer_account_id")
      .notNull()
      .references(() => employerAccounts.id, { onDelete: "restrict" }),
    industryId: uuid("industry_id")
      .notNull()
      .references(() => industries.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    foundingYear: integer("founding_year"),
    logoUrl: text("logo_url"),
    ...timestamps,
  },
  (table) => [
    unique("companies_employer_account_unique").on(table.employerAccountId),
    index("companies_industry_id_idx").on(table.industryId),
    check(
      "companies_founding_year_check",
      sql`${table.foundingYear} is null or ${table.foundingYear} between 1000 and 9999`,
    ),
  ],
);

export const benefits = pgTable("benefits", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  ...timestamps,
});

export const companyBenefits = pgTable(
  "company_benefits",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => benefits.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.benefitId] })],
);

export const companyImages = pgTable(
  "company_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("company_images_company_sort_unique").on(table.companyId, table.sortOrder),
    index("company_images_company_id_idx").on(table.companyId),
    check("company_images_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const jobPackages = pgTable(
  "job_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    jobCredits: integer("job_credits").notNull(),
    priceToman: integer("price_toman").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    check("job_packages_credits_check", sql`${table.jobCredits} > 0`),
    check("job_packages_price_check", sql`${table.priceToman} >= 0`),
  ],
);

export const packagePurchases = pgTable(
  "package_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    jobPackageId: uuid("job_package_id")
      .notNull()
      .references(() => jobPackages.id, { onDelete: "restrict" }),
    packageName: varchar("package_name", { length: 120 }).notNull(),
    jobCredits: integer("job_credits").notNull(),
    priceToman: integer("price_toman").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    index("package_purchases_company_id_idx").on(table.companyId),
    check("package_purchases_credits_check", sql`${table.jobCredits} > 0`),
    check("package_purchases_price_check", sql`${table.priceToman} >= 0`),
  ],
);

export const companyJobCreditTransactions = pgTable(
  "company_job_credit_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    packagePurchaseId: uuid("package_purchase_id").references(() => packagePurchases.id, {
      onDelete: "restrict",
    }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("credit_transactions_purchase_unique").on(table.packagePurchaseId),
    index("credit_transactions_company_id_idx").on(table.companyId),
    check("credit_transactions_amount_check", sql`${table.amount} <> 0`),
  ],
);

export const jobPostStatus = pgEnum("job_post_status", ["draft", "published", "closed"]);

export const jobPosts = pgTable(
  "job_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    status: jobPostStatus("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => [index("job_posts_company_id_idx").on(table.companyId)],
);

export const employerAccountRelations = relations(employerAccounts, ({ one, many }) => ({
  company: one(companies),
  sessions: many(employerSessions),
}));

export const employerSessionRelations = relations(employerSessions, ({ one }) => ({
  employerAccount: one(employerAccounts, {
    fields: [employerSessions.employerAccountId],
    references: [employerAccounts.id],
  }),
}));

export const industryRelations = relations(industries, ({ many }) => ({
  companies: many(companies),
}));

export const companyRelations = relations(companies, ({ one, many }) => ({
  employerAccount: one(employerAccounts, {
    fields: [companies.employerAccountId],
    references: [employerAccounts.id],
  }),
  industry: one(industries, {
    fields: [companies.industryId],
    references: [industries.id],
  }),
  benefits: many(companyBenefits),
  images: many(companyImages),
  purchases: many(packagePurchases),
  creditTransactions: many(companyJobCreditTransactions),
  jobPosts: many(jobPosts),
}));

export const benefitRelations = relations(benefits, ({ many }) => ({
  companies: many(companyBenefits),
}));

export const companyBenefitRelations = relations(companyBenefits, ({ one }) => ({
  company: one(companies, {
    fields: [companyBenefits.companyId],
    references: [companies.id],
  }),
  benefit: one(benefits, {
    fields: [companyBenefits.benefitId],
    references: [benefits.id],
  }),
}));

export const companyImageRelations = relations(companyImages, ({ one }) => ({
  company: one(companies, {
    fields: [companyImages.companyId],
    references: [companies.id],
  }),
}));

export const jobPackageRelations = relations(jobPackages, ({ many }) => ({
  purchases: many(packagePurchases),
}));

export const packagePurchaseRelations = relations(packagePurchases, ({ one }) => ({
  company: one(companies, {
    fields: [packagePurchases.companyId],
    references: [companies.id],
  }),
  jobPackage: one(jobPackages, {
    fields: [packagePurchases.jobPackageId],
    references: [jobPackages.id],
  }),
  creditTransaction: one(companyJobCreditTransactions),
}));

export const companyJobCreditTransactionRelations = relations(
  companyJobCreditTransactions,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyJobCreditTransactions.companyId],
      references: [companies.id],
    }),
    packagePurchase: one(packagePurchases, {
      fields: [companyJobCreditTransactions.packagePurchaseId],
      references: [packagePurchases.id],
    }),
  }),
);

export const jobPostRelations = relations(jobPosts, ({ one }) => ({
  company: one(companies, {
    fields: [jobPosts.companyId],
    references: [companies.id],
  }),
}));
