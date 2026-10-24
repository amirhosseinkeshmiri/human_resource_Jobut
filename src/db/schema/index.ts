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

export const smsRateLimits = pgTable(
  "sms_rate_limits",
  {
    bucketKey: varchar("bucket_key", { length: 100 }).primaryKey(),
    requestCount: integer("request_count").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("sms_rate_limits_expires_at_idx").on(table.expiresAt),
    check("sms_rate_limits_request_count_check", sql`${table.requestCount} > 0`),
    check(
      "sms_rate_limits_window_check",
      sql`${table.expiresAt} > ${table.windowStartedAt}`,
    ),
  ],
);

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

export const candidateJobPreferences = pgTable(
  "candidate_job_preferences",
  {
    candidateAccountId: uuid("candidate_account_id")
      .primaryKey()
      .references(() => candidateAccounts.id, { onDelete: "cascade" }),
    preferredLocations: text("preferred_locations")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    preferredWorkplaceTypes: workplaceType("preferred_workplace_types")
      .array()
      .default(sql`'{}'::workplace_type[]`)
      .notNull(),
    preferredEmploymentTypes: employmentType("preferred_employment_types")
      .array()
      .default(sql`'{}'::employment_type[]`)
      .notNull(),
    preferredSeniorityLevels: seniorityLevel("preferred_seniority_levels")
      .array()
      .default(sql`'{}'::seniority_level[]`)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "candidate_job_preferences_locations_count_check",
      sql`cardinality(${table.preferredLocations}) <= 5`,
    ),
    check(
      "candidate_job_preferences_workplace_count_check",
      sql`cardinality(${table.preferredWorkplaceTypes}) <= 3`,
    ),
    check(
      "candidate_job_preferences_employment_count_check",
      sql`cardinality(${table.preferredEmploymentTypes}) <= 4`,
    ),
    check(
      "candidate_job_preferences_seniority_count_check",
      sql`cardinality(${table.preferredSeniorityLevels}) <= 5`,
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

export const applicationMessageSenderRole = pgEnum("application_message_sender_role", [
  "employer",
  "candidate",
]);

export const applicationMessageKind = pgEnum("application_message_kind", [
  "recruitment_message",
  "interview_invitation",
]);

export const applicationMessageEventType = pgEnum("application_message_event_type", [
  "sent",
  "read",
]);

export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateAccountId: uuid("candidate_account_id")
      .notNull()
      .references(() => candidateAccounts.id, { onDelete: "restrict" }),
    candidateResumeId: uuid("candidate_resume_id")
      .references(() => candidateResumes.id, { onDelete: "set null" }),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "restrict" }),
    status: applicationStatus("status").default("received").notNull(),
    employerNote: text("employer_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("job_applications_candidate_job_unique").on(table.candidateAccountId, table.jobPostId),
    index("job_applications_candidate_id_idx").on(table.candidateAccountId),
    index("job_applications_resume_id_idx").on(table.candidateResumeId),
    index("job_applications_job_id_idx").on(table.jobPostId),
  ],
);

export const applicationResumeSnapshots = pgTable("application_resume_snapshots", {
  jobApplicationId: uuid("job_application_id")
    .primaryKey()
    .references(() => jobApplications.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  city: varchar("city", { length: 160 }).notNull(),
  professionalTitle: varchar("professional_title", { length: 160 }).notNull(),
  professionalSummary: text("professional_summary").notNull(),
  skills: text("skills").array().notNull(),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applicationResumeSnapshotExperiences = pgTable(
  "application_resume_snapshot_experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => applicationResumeSnapshots.jobApplicationId, { onDelete: "cascade" }),
    jobTitle: varchar("job_title", { length: 160 }).notNull(),
    companyName: varchar("company_name", { length: 200 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("application_resume_snapshot_experiences_sort_unique").on(
      table.jobApplicationId,
      table.sortOrder,
    ),
    index("application_resume_snapshot_experiences_application_idx").on(
      table.jobApplicationId,
    ),
    check("application_resume_snapshot_experiences_sort_check", sql`${table.sortOrder} >= 0`),
    check(
      "application_resume_snapshot_experiences_dates_check",
      sql`(${table.isCurrent} = true and ${table.endDate} is null) or (${table.isCurrent} = false and ${table.endDate} is not null and ${table.endDate} >= ${table.startDate})`,
    ),
  ],
);

export const applicationResumeSnapshotEducations = pgTable(
  "application_resume_snapshot_educations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => applicationResumeSnapshots.jobApplicationId, { onDelete: "cascade" }),
    fieldOfStudy: varchar("field_of_study", { length: 160 }).notNull(),
    institutionName: varchar("institution_name", { length: 200 }).notNull(),
    degree: varchar("degree", { length: 120 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("application_resume_snapshot_educations_sort_unique").on(
      table.jobApplicationId,
      table.sortOrder,
    ),
    index("application_resume_snapshot_educations_application_idx").on(
      table.jobApplicationId,
    ),
    check("application_resume_snapshot_educations_sort_check", sql`${table.sortOrder} >= 0`),
    check(
      "application_resume_snapshot_educations_dates_check",
      sql`(${table.isCurrent} = true and ${table.endDate} is null) or (${table.isCurrent} = false and ${table.endDate} is not null and ${table.endDate} >= ${table.startDate})`,
    ),
  ],
);

export const applicationResumeSnapshotLanguages = pgTable(
  "application_resume_snapshot_languages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => applicationResumeSnapshots.jobApplicationId, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    proficiency: resumeLanguageProficiency("proficiency").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("application_resume_snapshot_languages_sort_unique").on(
      table.jobApplicationId,
      table.sortOrder,
    ),
    index("application_resume_snapshot_languages_application_idx").on(
      table.jobApplicationId,
    ),
    check("application_resume_snapshot_languages_sort_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const jobApplicationStatusHistory = pgTable(
  "job_application_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "restrict" }),
    fromStatus: applicationStatus("from_status").notNull(),
    toStatus: applicationStatus("to_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("job_application_status_history_application_changed_idx").on(
      table.jobApplicationId,
      table.changedAt,
    ),
  ],
);

export const applicationMessages = pgTable(
  "application_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobApplicationId: uuid("job_application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    senderRole: applicationMessageSenderRole("sender_role").notNull(),
    senderEmployerAccountId: uuid("sender_employer_account_id")
      .references(() => employerAccounts.id, { onDelete: "restrict" }),
    senderCandidateAccountId: uuid("sender_candidate_account_id")
      .references(() => candidateAccounts.id, { onDelete: "restrict" }),
    kind: applicationMessageKind("kind").default("recruitment_message").notNull(),
    body: text("body").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    unique("application_messages_idempotency_unique").on(
      table.jobApplicationId,
      table.senderRole,
      table.idempotencyKey,
    ),
    index("application_messages_application_created_idx").on(
      table.jobApplicationId,
      table.createdAt,
    ),
    check("application_messages_body_length_check", sql`char_length(${table.body}) between 1 and 2000`),
    check(
      "application_messages_sender_check",
      sql`(${table.senderRole} = 'employer' and ${table.senderEmployerAccountId} is not null and ${table.senderCandidateAccountId} is null) or (${table.senderRole} = 'candidate' and ${table.senderCandidateAccountId} is not null and ${table.senderEmployerAccountId} is null)`,
    ),
    check(
      "application_messages_kind_sender_check",
      sql`${table.kind} <> 'interview_invitation' or ${table.senderRole} = 'employer'`,
    ),
    check("application_messages_read_time_check", sql`${table.readAt} is null or ${table.readAt} >= ${table.createdAt}`),
  ],
);

export const applicationMessageEvents = pgTable(
  "application_message_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationMessageId: uuid("application_message_id")
      .notNull()
      .references(() => applicationMessages.id, { onDelete: "cascade" }),
    eventType: applicationMessageEventType("event_type").notNull(),
    actorRole: applicationMessageSenderRole("actor_role").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("application_message_events_type_unique").on(table.applicationMessageId, table.eventType),
    index("application_message_events_message_idx").on(table.applicationMessageId, table.occurredAt),
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
  jobPreferences: one(candidateJobPreferences),
  applications: many(jobApplications),
}));

export const candidateJobPreferenceRelations = relations(candidateJobPreferences, ({ one }) => ({
  candidateAccount: one(candidateAccounts, {
    fields: [candidateJobPreferences.candidateAccountId],
    references: [candidateAccounts.id],
  }),
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
  resumeSnapshot: one(applicationResumeSnapshots),
}));

export const applicationResumeSnapshotRelations = relations(
  applicationResumeSnapshots,
  ({ one, many }) => ({
    application: one(jobApplications, {
      fields: [applicationResumeSnapshots.jobApplicationId],
      references: [jobApplications.id],
    }),
    experiences: many(applicationResumeSnapshotExperiences),
    educations: many(applicationResumeSnapshotEducations),
    languages: many(applicationResumeSnapshotLanguages),
  }),
);

export const applicationResumeSnapshotExperienceRelations = relations(
  applicationResumeSnapshotExperiences,
  ({ one }) => ({
    snapshot: one(applicationResumeSnapshots, {
      fields: [applicationResumeSnapshotExperiences.jobApplicationId],
      references: [applicationResumeSnapshots.jobApplicationId],
    }),
  }),
);

export const applicationResumeSnapshotEducationRelations = relations(
  applicationResumeSnapshotEducations,
  ({ one }) => ({
    snapshot: one(applicationResumeSnapshots, {
      fields: [applicationResumeSnapshotEducations.jobApplicationId],
      references: [applicationResumeSnapshots.jobApplicationId],
    }),
  }),
);

export const applicationResumeSnapshotLanguageRelations = relations(
  applicationResumeSnapshotLanguages,
  ({ one }) => ({
    snapshot: one(applicationResumeSnapshots, {
      fields: [applicationResumeSnapshotLanguages.jobApplicationId],
      references: [applicationResumeSnapshots.jobApplicationId],
    }),
  }),
);
