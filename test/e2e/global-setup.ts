import { createHash } from "node:crypto";
import postgres from "postgres";
import { ids, tokens } from "./fixtures";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export default async function globalSetup() {
  if (process.env.E2E_TESTS !== "1" || !process.env.DATABASE_URL) {
    throw new Error("E2E_TESTS=1 and a verified disposable DATABASE_URL are required");
  }
  const url = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || !url.pathname.toLowerCase().includes("test")) {
    throw new Error("Refusing to seed a non-local or non-test database");
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
  try {
    await sql.begin(async (tx) => {
      await tx`delete from job_posts where company_id in (${ids.companyA}, ${ids.companyB})`;
      await tx`delete from companies where id in (${ids.companyA}, ${ids.companyB})`;
      await tx`delete from employer_accounts where id in (${ids.employerA}, ${ids.employerB})`;
      await tx`delete from candidate_accounts where id in (${ids.candidateA}, ${ids.candidateB})`;
      await tx`insert into industries (id, name, slug) values (${ids.industry}, 'E2E فناوری', 'e2e-technology') on conflict (id) do update set name = excluded.name`;
      await tx`insert into employer_accounts (id, email) values (${ids.employerA}, 'e2e-employer-a@example.test'), (${ids.employerB}, 'e2e-employer-b@example.test')`;
      await tx`insert into employer_sessions (employer_account_id, token_digest, expires_at) values (${ids.employerA}, ${digest(tokens.employerA)}, ${expiresAt}), (${ids.employerB}, ${digest(tokens.employerB)}, ${expiresAt})`;
      await tx`insert into companies (id, employer_account_id, industry_id, name, address, founding_year, logo_url) values (${ids.companyA}, ${ids.employerA}, ${ids.industry}, 'شرکت آزمون الف', 'تهران، نشانی آزمون', 1400, '/e2e-logo-a.png'), (${ids.companyB}, ${ids.employerB}, ${ids.industry}, 'شرکت آزمون ب', 'شیراز، نشانی آزمون', 1399, '/e2e-logo-b.png')`;
      await tx`insert into job_posts (id, company_id, title, status, workplace_type, employment_type, location, seniority_level, salary_negotiable, required_skills, description) values (${ids.jobA}, ${ids.companyA}, 'آگهی موجود آزمون', 'draft', 'remote', 'full_time', 'تهران', 'mid_level', true, array['TypeScript'], '<p>شرح موجود</p>')`;
      await tx`insert into candidate_accounts (id, email) values (${ids.candidateA}, 'e2e-candidate-a@example.test'), (${ids.candidateB}, 'e2e-candidate-b@example.test')`;
      await tx`insert into candidate_sessions (candidate_account_id, token_digest, expires_at) values (${ids.candidateA}, ${digest(tokens.candidateA)}, ${expiresAt}), (${ids.candidateB}, ${digest(tokens.candidateB)}, ${expiresAt})`;
      await tx`insert into candidate_job_preferences (candidate_account_id, preferred_locations, preferred_workplace_types, preferred_employment_types, preferred_seniority_levels) values (${ids.candidateA}, array['تهران'], array['remote']::workplace_type[], array['full_time']::employment_type[], array['mid_level']::seniority_level[]), (${ids.candidateB}, array['شیراز'], array[]::workplace_type[], array[]::employment_type[], array[]::seniority_level[])`;
      await tx`insert into candidate_resumes (id, candidate_account_id, first_name, last_name, city, professional_title, professional_summary, skills) values (${ids.resumeA}, ${ids.candidateA}, 'نام', 'آزمایشی', 'تهران', 'عنوان ذخیره‌شده', 'خلاصه ذخیره‌شده', array['TypeScript'])`;
    });
  } finally {
    await sql.end();
  }
}
