import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { getEmployerApplicantResume } from "../../src/applicants/queries";
import { createCandidateApplication } from "../../src/applications/domain";
import { getCandidateApplicationResumeSnapshot } from "../../src/applications/queries";
import { endDatabaseConnection } from "../../src/db";
import { saveCandidateResumeData } from "../../src/resume/persistence";
import type { CandidateResumeValues } from "../../src/resume/validation";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.INTEGRATION_TESTS !== "1" || !parsedDatabaseUrl || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname) || parsedDatabaseUrl.pathname !== "/jobut_test") {
  throw new Error("Integration tests require an explicitly enabled local jobut_test database");
}
const sql = postgres(parsedDatabaseUrl.toString(), { max: 6, prepare: false });
const ids = {
  industry: "11000000-0000-4000-8000-000000000001",
  employerA: "21000000-0000-4000-8000-000000000001",
  employerB: "21000000-0000-4000-8000-000000000002",
  companyA: "31000000-0000-4000-8000-000000000001",
  companyB: "31000000-0000-4000-8000-000000000002",
  candidateA: "71000000-0000-4000-8000-000000000001",
  candidateB: "71000000-0000-4000-8000-000000000002",
  job: "61000000-0000-4000-8000-000000000001",
  jobConcurrent: "61000000-0000-4000-8000-000000000002",
};
const originalResume: CandidateResumeValues = {
  firstName: "سارا", lastName: "آزمایشی", city: "تهران", professionalTitle: "مهندس نرم‌افزار",
  professionalSummary: "نسخه اولیه", skills: ["TypeScript"], linkedinUrl: null, portfolioUrl: null,
  experiences: [{ jobTitle: "توسعه‌دهنده", companyName: "شرکت قبلی", startDate: "2023-01-01", endDate: null, isCurrent: true, description: "تجربه اولیه" }],
  educations: [{ fieldOfStudy: "مهندسی کامپیوتر", institutionName: "دانشگاه آزمون", degree: "کارشناسی", startDate: "2018-01-01", endDate: "2022-01-01", isCurrent: false }],
  languages: [{ name: "انگلیسی", proficiency: "advanced" }],
};

before(async () => {
  await sql`truncate table employer_accounts, candidate_accounts, industries cascade`;
  await sql`insert into industries (id, name, slug) values (${ids.industry}, 'Snapshot Integration', 'snapshot-integration')`;
  await sql`insert into employer_accounts (id, mobile) values (${ids.employerA}, '+989120000011'), (${ids.employerB}, '+989120000012')`;
  await sql`insert into companies (id, employer_account_id, industry_id, name, address, founding_year) values (${ids.companyA}, ${ids.employerA}, ${ids.industry}, 'Company A', 'Test', 1400), (${ids.companyB}, ${ids.employerB}, ${ids.industry}, 'Company B', 'Test', 1400)`;
  await sql`insert into candidate_accounts (id, mobile) values (${ids.candidateA}, '+989130000011'), (${ids.candidateB}, '+989130000012')`;
  await sql`insert into job_posts (id, company_id, title, status, workplace_type, employment_type, location, seniority_level, salary_negotiable, required_skills, description, published_at, expires_at) values (${ids.job}, ${ids.companyA}, 'Snapshot Job', 'published', 'hybrid', 'full_time', 'Tehran', 'mid_level', true, array['TypeScript'], '<p>Test description</p>', now() - interval '1 day', now() + interval '30 days'), (${ids.jobConcurrent}, ${ids.companyA}, 'Concurrent Job', 'published', 'remote', 'full_time', 'Remote', 'mid_level', true, array['TypeScript'], '<p>Test description</p>', now() - interval '1 day', now() + interval '30 days')`;
  await saveCandidateResumeData(ids.candidateA, originalResume);
  await saveCandidateResumeData(ids.candidateB, originalResume);
});

after(async () => { await endDatabaseConnection(); await sql.end(); });

test("application atomically captures exact nested resume content and remains immutable after edits", async () => {
  assert.equal(await createCandidateApplication(ids.candidateA, ids.job), "created");
  const [application] = await sql`select id from job_applications where candidate_account_id = ${ids.candidateA} and job_post_id = ${ids.job}`;
  const beforeEdit = await getCandidateApplicationResumeSnapshot(ids.candidateA, application.id);
  assert.equal(beforeEdit?.professionalSummary, "نسخه اولیه");
  assert.deepEqual(beforeEdit?.skills, ["TypeScript"]);
  assert.equal(beforeEdit?.experiences[0]?.description, "تجربه اولیه");
  assert.equal(beforeEdit?.educations[0]?.institutionName, "دانشگاه آزمون");
  assert.equal(beforeEdit?.languages[0]?.name, "انگلیسی");

  await saveCandidateResumeData(ids.candidateA, { ...originalResume, professionalSummary: "نسخه ویرایش‌شده", skills: ["Rust"], experiences: [], educations: [], languages: [] });
  const afterEdit = await getCandidateApplicationResumeSnapshot(ids.candidateA, application.id);
  assert.deepEqual(afterEdit, beforeEdit);
});

test("concurrent idempotent submissions create exactly one application and one snapshot", async () => {
  const results = await Promise.all([
    createCandidateApplication(ids.candidateA, ids.jobConcurrent),
    createCandidateApplication(ids.candidateA, ids.jobConcurrent),
  ]);
  assert.deepEqual(results.sort(), ["already-applied", "created"]);
  const [counts] = await sql`select count(*)::int as applications, count(s.job_application_id)::int as snapshots from job_applications a left join application_resume_snapshots s on s.job_application_id = a.id where a.candidate_account_id = ${ids.candidateA} and a.job_post_id = ${ids.jobConcurrent}`;
  assert.deepEqual(counts, { applications: 1, snapshots: 1 });
});

test("concurrent resume edit and submission cannot produce a mixed snapshot", async () => {
  const edited = { ...originalResume, professionalSummary: "نسخه دوم", skills: ["PostgreSQL"], experiences: [], educations: [], languages: [] };
  await Promise.all([
    createCandidateApplication(ids.candidateB, ids.jobConcurrent),
    saveCandidateResumeData(ids.candidateB, edited),
  ]);
  const [application] = await sql`select id from job_applications where candidate_account_id = ${ids.candidateB} and job_post_id = ${ids.jobConcurrent}`;
  const snapshot = await getCandidateApplicationResumeSnapshot(ids.candidateB, application.id);
  const isOld = snapshot?.professionalSummary === "نسخه اولیه" && snapshot.skills?.[0] === "TypeScript" && snapshot.experiences.length === 1 && snapshot.educations.length === 1 && snapshot.languages.length === 1;
  const isNew = snapshot?.professionalSummary === "نسخه دوم" && snapshot.skills?.[0] === "PostgreSQL" && snapshot.experiences.length === 0 && snapshot.educations.length === 0 && snapshot.languages.length === 0;
  assert.equal(isOld || isNew, true);
});

test("legacy applications do not borrow current resume and tenant boundaries reject IDOR", async () => {
  const [resume] = await sql`select id from candidate_resumes where candidate_account_id = ${ids.candidateA}`;
  const [legacy] = await sql`insert into job_applications (candidate_account_id, candidate_resume_id, job_post_id) values (${ids.candidateA}, ${resume.id}, ${ids.job}) on conflict (candidate_account_id, job_post_id) do update set candidate_resume_id = excluded.candidate_resume_id returning id`;
  await sql`delete from application_resume_snapshots where job_application_id = ${legacy.id}`;
  const owned = await getCandidateApplicationResumeSnapshot(ids.candidateA, legacy.id);
  assert.equal(owned?.snapshotAvailable, false);
  assert.equal(owned?.professionalSummary, null);
  assert.equal(await getCandidateApplicationResumeSnapshot(ids.candidateB, legacy.id), null);
  assert.equal(await getEmployerApplicantResume(ids.companyB, ids.job, legacy.id), null);
  assert.equal((await getEmployerApplicantResume(ids.companyA, ids.job, legacy.id))?.snapshotAvailable, false);
});
