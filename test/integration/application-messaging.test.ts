import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { endDatabaseConnection } from "../../src/db";
import {
  getApplicationMessagesForCandidate,
  getApplicationMessagesForEmployer,
  markApplicationMessagesRead,
  sendApplicationMessage,
} from "../../src/messages/domain";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.INTEGRATION_TESTS !== "1" || !parsedDatabaseUrl || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname) || parsedDatabaseUrl.pathname !== "/jobut_test") {
  throw new Error("Integration tests require an explicitly enabled local jobut_test database");
}
const sql = postgres(parsedDatabaseUrl.toString(), { max: 8, prepare: false });
const ids = {
  industry: "12000000-0000-4000-8000-000000000001",
  employerA: "22000000-0000-4000-8000-000000000001",
  employerB: "22000000-0000-4000-8000-000000000002",
  companyA: "32000000-0000-4000-8000-000000000001",
  companyB: "32000000-0000-4000-8000-000000000002",
  candidateA: "72000000-0000-4000-8000-000000000001",
  candidateB: "72000000-0000-4000-8000-000000000002",
  jobA: "62000000-0000-4000-8000-000000000001",
  jobB: "62000000-0000-4000-8000-000000000002",
  applicationA: "82000000-0000-4000-8000-000000000001",
  applicationB: "82000000-0000-4000-8000-000000000002",
};
const key = (suffix: number) => `92000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

before(async () => {
  await sql`truncate table employer_accounts, candidate_accounts, industries cascade`;
  await sql`insert into industries (id, name, slug) values (${ids.industry}, 'Messaging Integration', 'messaging-integration')`;
  await sql`insert into employer_accounts (id, mobile) values (${ids.employerA}, '+989120000021'), (${ids.employerB}, '+989120000022')`;
  await sql`insert into companies (id, employer_account_id, industry_id, name, address, founding_year) values (${ids.companyA}, ${ids.employerA}, ${ids.industry}, 'Message Company A', 'Test', 1400), (${ids.companyB}, ${ids.employerB}, ${ids.industry}, 'Message Company B', 'Test', 1400)`;
  await sql`insert into candidate_accounts (id, mobile) values (${ids.candidateA}, '+989130000021'), (${ids.candidateB}, '+989130000022')`;
  await sql`insert into job_posts (id, company_id, title, status, published_at, expires_at) values (${ids.jobA}, ${ids.companyA}, 'Message Job A', 'published', now(), now() + interval '30 days'), (${ids.jobB}, ${ids.companyB}, 'Message Job B', 'published', now(), now() + interval '30 days')`;
  await sql`insert into job_applications (id, candidate_account_id, job_post_id, status) values (${ids.applicationA}, ${ids.candidateA}, ${ids.jobA}, 'reviewing'), (${ids.applicationB}, ${ids.candidateB}, ${ids.jobB}, 'reviewing')`;
  await sql`insert into application_resume_snapshots (job_application_id, first_name, last_name, city, professional_title, professional_summary, skills) values (${ids.applicationA}, 'Test', 'Candidate', 'Tehran', 'Engineer', 'Immutable', array['TypeScript'])`;
});

after(async () => { await endDatabaseConnection(); await sql.end(); });

test("owned employer message is visible only to the correct candidate and company", async () => {
  assert.equal(await sendApplicationMessage({ role: "employer", employerAccountId: ids.employerA, companyId: ids.companyA, applicationId: ids.applicationA, idempotencyKey: key(1), kind: "interview_invitation", body: "دعوت به مصاحبه آزمایشی" }), "sent");
  assert.equal((await getApplicationMessagesForCandidate({ candidateAccountId: ids.candidateA, applicationId: ids.applicationA }))?.messages.length, 1);
  assert.equal(await getApplicationMessagesForCandidate({ candidateAccountId: ids.candidateB, applicationId: ids.applicationA }), null);
  assert.equal(await getApplicationMessagesForEmployer({ employerAccountId: ids.employerB, companyId: ids.companyB, applicationId: ids.applicationA }), null);
  assert.equal(await sendApplicationMessage({ role: "employer", employerAccountId: ids.employerB, companyId: ids.companyA, applicationId: ids.applicationA, idempotencyKey: key(2), kind: "recruitment_message", body: "شناسه فرستنده جعلی" }), "not-found");
});

test("candidate can reply only after an owned employer message", async () => {
  assert.equal(await sendApplicationMessage({ role: "candidate", candidateAccountId: ids.candidateB, applicationId: ids.applicationB, idempotencyKey: key(3), kind: "recruitment_message", body: "پاسخ زودهنگام" }), "unavailable");
  assert.equal(await sendApplicationMessage({ role: "candidate", candidateAccountId: ids.candidateA, applicationId: ids.applicationA, idempotencyKey: key(4), kind: "recruitment_message", body: "دعوت را دریافت کردم" }), "sent");
  assert.equal((await getApplicationMessagesForEmployer({ employerAccountId: ids.employerA, companyId: ids.companyA, applicationId: ids.applicationA }))?.messages.length, 2);
});

test("replay and concurrent duplicate submission produce one auditable message", async () => {
  const input = { role: "employer" as const, employerAccountId: ids.employerA, companyId: ids.companyA, applicationId: ids.applicationA, idempotencyKey: key(5), kind: "recruitment_message" as const, body: "پیام هم‌زمان یکتا" };
  const results = await Promise.all([sendApplicationMessage(input), sendApplicationMessage(input)]);
  assert.deepEqual(results.sort(), ["replayed", "sent"]);
  assert.equal(await sendApplicationMessage(input), "replayed");
  const [counts] = await sql`select count(*)::int as messages, count(e.id)::int as events from application_messages m left join application_message_events e on e.application_message_id = m.id and e.event_type = 'sent' where m.idempotency_key = ${key(5)} group by m.id`;
  assert.deepEqual(counts, { messages: 1, events: 1 });
});

test("invalid content, unrelated and unavailable applications cannot be messaged", async () => {
  assert.equal(await sendApplicationMessage({ role: "employer", employerAccountId: ids.employerA, companyId: ids.companyA, applicationId: ids.applicationA, idempotencyKey: key(6), kind: "recruitment_message", body: " " }), "invalid");
  assert.equal(await sendApplicationMessage({ role: "candidate", candidateAccountId: ids.candidateB, applicationId: ids.applicationA, idempotencyKey: key(7), kind: "recruitment_message", body: "دسترسی غیرمجاز" }), "not-found");
  await sql`update job_applications set status = 'rejected' where id = ${ids.applicationA}`;
  assert.equal(await sendApplicationMessage({ role: "employer", employerAccountId: ids.employerA, companyId: ids.companyA, applicationId: ids.applicationA, idempotencyKey: key(8), kind: "recruitment_message", body: "پس از رد" }), "unavailable");
  await sql`update job_applications set status = 'reviewing' where id = ${ids.applicationA}`;
});

test("recipient read status is scoped, audited, and does not mutate resume snapshot", async () => {
  const before = await sql`select * from application_resume_snapshots where job_application_id = ${ids.applicationA}`;
  assert.equal(await markApplicationMessagesRead({ applicationId: ids.applicationA, readerRole: "candidate", candidateAccountId: ids.candidateB }), "not-found");
  assert.equal(await markApplicationMessagesRead({ applicationId: ids.applicationA, readerRole: "candidate", candidateAccountId: ids.candidateA }), "updated");
  const after = await sql`select * from application_resume_snapshots where job_application_id = ${ids.applicationA}`;
  assert.deepEqual(after, before);
  const events = await sql`select event_type from application_message_events where event_type = 'read'`;
  assert.ok(events.length >= 1);
});

test("atomic per-application quota blocks excess sends across connections", async () => {
  const base = new Date("2026-10-24T10:00:00.000Z");
  for (let index = 0; index < 5; index += 1) {
    assert.equal(await sendApplicationMessage({ role: "employer", employerAccountId: ids.employerB, companyId: ids.companyB, applicationId: ids.applicationB, idempotencyKey: key(20 + index), kind: "recruitment_message", body: `پیام سهمیه ${index}`, now: base }), "sent");
  }
  assert.equal(await sendApplicationMessage({ role: "employer", employerAccountId: ids.employerB, companyId: ids.companyB, applicationId: ids.applicationB, idempotencyKey: key(30), kind: "recruitment_message", body: "پیام بیش از سهمیه", now: base }), "rate-limited");
});
