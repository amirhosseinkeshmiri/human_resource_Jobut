import { relations, sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  check,
  date,
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

export const packagePurchaseStatus = pgEnum("package_purchase_status", ["pending", "paid"]);

export const paymentAttemptStatus = pgEnum("payment_attempt_status", [
  "created",
  "redirect_ready",
  "verified",
  "failed",
  "canceled",
]);

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
    status: packagePurchaseStatus("status").default("pending").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("package_purchases_company_id_idx").on(table.companyId),
    check("package_purchases_credits_check", sql`${table.jobCredits} > 0`),
    check("package_purchases_price_check", sql`${table.priceToman} >= 0`),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packagePurchaseId: uuid("package_purchase_id")
      .notNull()
      .references(() => packagePurchases.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 16 }).default("SEP").notNull(),
    status: paymentAttemptStatus("status").default("created").notNull(),
    amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
    resNum: varchar("res_num", { length: 80 }).notNull().unique(),
    refNum: varchar("ref_num", { length: 160 }).unique(),
    gatewayState: varchar("gateway_state", { length: 80 }),
    failureCategory: varchar("failure_category", { length: 80 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("payment_attempts_purchase_id_idx").on(table.packagePurchaseId),
    index("payment_attempts_active_idx").on(
      table.packagePurchaseId,
      table.status,
      table.createdAt,
    ),
    check("payment_attempts_provider_check", sql`${table.provider} = 'SEP'`),
    check("payment_attempts_amount_check", sql`${table.amountRial} > 0`),
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
export const workplaceType = pgEnum("workplace_type", ["onsite", "remote", "hybrid"]);
export const employmentType = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "project",
  "internship",
]);
export const seniorityLevel = pgEnum("seniority_level", [
  "intern",
  "junior",
  "mid_level",
  "senior",
  "lead",
]);

export const jobPosts = pgTable(
  "job_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    status: jobPostStatus("status").default("draft").notNull(),
    workplaceType: workplaceType("workplace_type"),
    employmentType: employmentType("employment_type"),
    location: varchar("location", { length: 160 }),
    seniorityLevel: seniorityLevel("seniority_level"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryNegotiable: boolean("salary_negotiable"),
    requiredSkills: text("required_skills").array(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("job_posts_company_id_idx").on(table.companyId),
    check(
      "job_posts_salary_check",
      sql`(${table.salaryMin} is null or ${table.salaryMin} >= 0) and (${table.salaryMax} is null or ${table.salaryMax} >= 0) and (${table.salaryMin} is null or ${table.salaryMax} is null or ${table.salaryMax} >= ${table.salaryMin})`,
    ),
  ],
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

export const candidateAccounts = pgTable(
  "candidate_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).unique(),
    mobile: varchar("mobile", { length: 20 }).unique(),
    ...timestamps,
  },
  (table) => [
    check(
      "candidate_accounts_contact_check",
      sql`${table.email} is not null or ${table.mobile} is not null`,
    ),
  ],
);

export const resumeLanguageProficiency = pgEnum("resume_language_proficiency", [
  "basic",
  "intermediate",
  "advanced",
  "fluent",
  "native",
]);

export const candidateResumes = pgTable(
  "candidate_resumes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateAccountId: uuid("candidate_account_id")
      .notNull()
      .references(() => candidateAccounts.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    city: varchar("city", { length: 160 }).notNull(),
    professionalTitle: varchar("professional_title", { length: 160 }).notNull(),
    professionalSummary: text("professional_summary").notNull(),
    skills: text("skills").array().notNull(),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    ...timestamps,
  },
  (table) => [unique("candidate_resumes_candidate_account_unique").on(table.candidateAccountId)],
);

export const resumeExperiences = pgTable(
  "resume_experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resumeId: uuid("resume_id").notNull().references(() => candidateResumes.id, { onDelete: "cascade" }),
    jobTitle: varchar("job_title", { length: 160 }).notNull(),
    companyName: varchar("company_name", { length: 200 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").default(false).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("resume_experiences_resume_sort_unique").on(table.resumeId, table.sortOrder),
    index("resume_experiences_resume_id_idx").on(table.resumeId),
    check("resume_experiences_sort_order_check", sql`${table.sortOrder} >= 0`),
    check("resume_experiences_dates_check", sql`(${table.isCurrent} = true and ${table.endDate} is null) or (${table.isCurrent} = false and ${table.endDate} is not null and ${table.endDate} >= ${table.startDate})`),
  ],
);

export const resumeEducations = pgTable(
  "resume_educations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resumeId: uuid("resume_id").notNull().references(() => candidateResumes.id, { onDelete: "cascade" }),
    fieldOfStudy: varchar("field_of_study", { length: 160 }).notNull(),
    institutionName: varchar("institution_name", { length: 200 }).notNull(),
    degree: varchar("degree", { length: 120 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").default(false).notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("resume_educations_resume_sort_unique").on(table.resumeId, table.sortOrder),
    index("resume_educations_resume_id_idx").on(table.resumeId),
    check("resume_educations_sort_order_check", sql`${table.sortOrder} >= 0`),
    check("resume_educations_dates_check", sql`(${table.isCurrent} = true and ${table.endDate} is null) or (${table.isCurrent} = false and ${table.endDate} is not null and ${table.endDate} >= ${table.startDate})`),
  ],
);

export const resumeLanguages = pgTable(
  "resume_languages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resumeId: uuid("resume_id").notNull().references(() => candidateResumes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    proficiency: resumeLanguageProficiency("proficiency").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("resume_languages_resume_sort_unique").on(table.resumeId, table.sortOrder),
    index("resume_languages_resume_id_idx").on(table.resumeId),
    check("resume_languages_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const applicationStatus = pgEnum("application_status", [
  "received",
  "reviewing",
  "interview",
  "rejected",
  "hired",
]);

export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateAccountId: uuid("candidate_account_id")
      .notNull()
      .references(() => candidateAccounts.id, { onDelete: "restrict" }),
    candidateResumeId: uuid("candidate_resume_id")
      .notNull()
      .references(() => candidateResumes.id, { onDelete: "restrict" }),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "restrict" }),
    status: applicationStatus("status").default("received").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("job_applications_candidate_job_unique").on(table.candidateAccountId, table.jobPostId),
    index("job_applications_candidate_id_idx").on(table.candidateAccountId),
    index("job_applications_resume_id_idx").on(table.candidateResumeId),
    index("job_applications_job_id_idx").on(table.jobPostId),
  ],
);

export const candidateIdentifierType = pgEnum("candidate_identifier_type", ["email", "mobile"]);

export const candidateAuthChallenges = pgTable(
  "candidate_auth_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: varchar("identifier", { length: 320 }).notNull(),
    identifierType: candidateIdentifierType("identifier_type").notNull(),
    codeDigest: varchar("code_digest", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("candidate_auth_challenges_identifier_idx").on(table.identifier),
    check(
      "candidate_auth_challenges_attempts_check",
      sql`${table.attempts} between 0 and 5`,
    ),
  ],
);

export const candidateSessions = pgTable(
  "candidate_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateAccountId: uuid("candidate_account_id")
      .notNull()
      .references(() => candidateAccounts.id, { onDelete: "cascade" }),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("candidate_sessions_account_id_idx").on(table.candidateAccountId)],
);

export const candidateAccountRelations = relations(candidateAccounts, ({ one, many }) => ({
  sessions: many(candidateSessions),
  resume: one(candidateResumes),
  applications: many(jobApplications),
}));

export const candidateResumeRelations = relations(candidateResumes, ({ one, many }) => ({
  candidateAccount: one(candidateAccounts, {
    fields: [candidateResumes.candidateAccountId],
    references: [candidateAccounts.id],
  }),
  experiences: many(resumeExperiences),
  educations: many(resumeEducations),
  languages: many(resumeLanguages),
  applications: many(jobApplications),
}));

export const resumeExperienceRelations = relations(resumeExperiences, ({ one }) => ({
  resume: one(candidateResumes, { fields: [resumeExperiences.resumeId], references: [candidateResumes.id] }),
}));

export const resumeEducationRelations = relations(resumeEducations, ({ one }) => ({
  resume: one(candidateResumes, { fields: [resumeEducations.resumeId], references: [candidateResumes.id] }),
}));

export const resumeLanguageRelations = relations(resumeLanguages, ({ one }) => ({
  resume: one(candidateResumes, { fields: [resumeLanguages.resumeId], references: [candidateResumes.id] }),
}));

export const candidateSessionRelations = relations(candidateSessions, ({ one }) => ({
  candidateAccount: one(candidateAccounts, {
    fields: [candidateSessions.candidateAccountId],
    references: [candidateAccounts.id],
  }),
}));

export const adminAccounts = pgTable(
  "admin_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).unique(),
    mobile: varchar("mobile", { length: 20 }).unique(),
    ...timestamps,
  },
  (table) => [
    check(
      "admin_accounts_contact_check",
      sql`${table.email} is not null or ${table.mobile} is not null`,
    ),
  ],
);

export const adminIdentifierType = pgEnum("admin_identifier_type", ["email", "mobile"]);

export const adminAuthChallenges = pgTable(
  "admin_auth_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: varchar("identifier", { length: 320 }).notNull(),
    identifierType: adminIdentifierType("identifier_type").notNull(),
    codeDigest: varchar("code_digest", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("admin_auth_challenges_identifier_idx").on(table.identifier),
    check(
      "admin_auth_challenges_attempts_check",
      sql`${table.attempts} between 0 and 5`,
    ),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminAccountId: uuid("admin_account_id")
      .notNull()
      .references(() => adminAccounts.id, { onDelete: "cascade" }),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("admin_sessions_account_id_idx").on(table.adminAccountId)],
);

export const adminAccountRelations = relations(adminAccounts, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionRelations = relations(adminSessions, ({ one }) => ({
  adminAccount: one(adminAccounts, {
    fields: [adminSessions.adminAccountId],
    references: [adminAccounts.id],
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

export const packagePurchaseRelations = relations(packagePurchases, ({ one, many }) => ({
  company: one(companies, {
    fields: [packagePurchases.companyId],
    references: [companies.id],
  }),
  jobPackage: one(jobPackages, {
    fields: [packagePurchases.jobPackageId],
    references: [jobPackages.id],
  }),
  creditTransaction: one(companyJobCreditTransactions),
  paymentAttempts: many(paymentAttempts),
}));

export const paymentAttemptRelations = relations(paymentAttempts, ({ one }) => ({
  packagePurchase: one(packagePurchases, {
    fields: [paymentAttempts.packagePurchaseId],
    references: [packagePurchases.id],
  }),
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

export const jobPostRelations = relations(jobPosts, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobPosts.companyId],
    references: [companies.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationRelations = relations(jobApplications, ({ one }) => ({
  candidateAccount: one(candidateAccounts, {
    fields: [jobApplications.candidateAccountId],
    references: [candidateAccounts.id],
  }),
  candidateResume: one(candidateResumes, {
    fields: [jobApplications.candidateResumeId],
    references: [candidateResumes.id],
  }),
  jobPost: one(jobPosts, {
    fields: [jobApplications.jobPostId],
    references: [jobPosts.id],
  }),
}));
