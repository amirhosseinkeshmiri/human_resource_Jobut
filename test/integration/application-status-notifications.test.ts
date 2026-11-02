import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { transitionEmployerApplicationStatus } from "../../src/applicants/mutations";
import { endDatabaseConnection } from "../../src/db";
import {
  getCandidateApplicationNotifications,
  markCandidateApplicationNotificationRead,
} from "../../src/notifications/repository";
import {
  deliverApplicationStatusNotifications,
  reconcileCandidateApplicationStatusNotifications,
} from "../../src/notifications/service";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.INTEGRATION_TESTS !== "1" || !parsedDatabaseUrl || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname) || parsedDatabaseUrl.pathname !== "/jobut_test") {
  throw new Error("Integration tests require an explicitly enabled local jobut_test database");
}
process.env.CANDIDATE_APPLICATION_NOTIFICATIONS_ENABLED = "true";
const sql = postgres(parsedDatabaseUrl.toString(), { max: 4, prepare: false });
const ids = {
  industry: "14000000-0000-4000-8000-000000000001",
  employer: "24000000-0000-4000-8000-000000000001",
  company: "34000000-0000-4000-8000-000000000001",
  candidateA: "74000000-0000-4000-8000-000000000001",
  candidateB: "74000000-0000-4000-8000-000000000002",
  job: "64000000-0000-4000-8000-000000000001",
  application: "84000000-0000-4000-8000-000000000001",
};

before(async () => {
  await sql`truncate table employer_accounts, candidate_accounts, industries cascade`;
  await sql`insert into industries (id, name, slug) values (${ids.industry}, 'Notification Integration', 'notification-integration')`;
  await sql`insert into employer_accounts (id, mobile) values (${ids.employer}, '+989150000001')`;
  await sql`insert into companies (id, employer_account_id, industry_id, name, address, founding_year) values (${ids.company}, ${ids.employer}, ${ids.industry}, 'Notification Company', 'Test', 1400)`;
  await sql`insert into candidate_accounts (id, mobile) values (${ids.candidateA}, '+989160000001'), (${ids.candidateB}, '+989160000002')`;
  await sql`insert into job_posts (id, company_id, title, status) values (${ids.job}, ${ids.company}, 'Notification Job', 'published')`;
  await sql`insert into job_applications (id, candidate_account_id, job_post_id, status) values (${ids.application}, ${ids.candidateA}, ${ids.job}, 'received')`;
});

after(async () => {
  delete process.env.CANDIDATE_APPLICATION_NOTIFICATIONS_ENABLED;
  await endDatabaseConnection();
  await sql.end();
});

test("successful status history materializes exactly one Candidate notification", async () => {
  assert.equal(await transitionEmployerApplicationStatus({ companyId: ids.company, jobId: ids.job, applicationId: ids.application, targetStatus: "reviewing" }), "updated");
  assert.equal(await deliverApplicationStatusNotifications(ids.application), "delivered");
  assert.equal(await deliverApplicationStatusNotifications(ids.application), "delivered");
  const data = await getCandidateApplicationNotifications(ids.candidateA, 1);
  assert.equal(data.total, 1);
  assert.equal(data.unread, 1);
  assert.equal(data.notifications[0]?.toStatus, "reviewing");
});

test("no-op transition creates neither history nor duplicate notification", async () => {
  assert.equal(await transitionEmployerApplicationStatus({ companyId: ids.company, jobId: ids.job, applicationId: ids.application, targetStatus: "reviewing" }), "noop");
  await reconcileCandidateApplicationStatusNotifications(ids.candidateA);
  assert.equal((await getCandidateApplicationNotifications(ids.candidateA, 1)).total, 1);
});

test("mark-as-read is idempotent and cross-account mutation is denied", async () => {
  const notification = (await getCandidateApplicationNotifications(ids.candidateA, 1)).notifications[0]!;
  assert.equal(await markCandidateApplicationNotificationRead(ids.candidateB, notification.id), "not-found");
  assert.equal(await markCandidateApplicationNotificationRead(ids.candidateA, notification.id), "updated");
  assert.equal(await markCandidateApplicationNotificationRead(ids.candidateA, notification.id), "already-read");
  assert.equal((await getCandidateApplicationNotifications(ids.candidateA, 1)).unread, 0);
  assert.equal((await getCandidateApplicationNotifications(ids.candidateB, 1)).total, 0);
});

test("notification failure does not roll back status/history and reconciliation recovers it", async () => {
  await sql`create function jobut_test_reject_notification() returns trigger language plpgsql as $$ begin raise exception 'test notification failure'; end $$`;
  await sql`create trigger jobut_test_reject_notification before insert on candidate_application_status_notifications for each row execute function jobut_test_reject_notification()`;
  try {
    assert.equal(await transitionEmployerApplicationStatus({ companyId: ids.company, jobId: ids.job, applicationId: ids.application, targetStatus: "interview" }), "updated");
    assert.equal(await deliverApplicationStatusNotifications(ids.application), "failed");
    const [application] = await sql`select status from job_applications where id = ${ids.application}`;
    const [history] = await sql`select count(*)::int as value from job_application_status_history where job_application_id = ${ids.application}`;
    assert.equal(application.status, "interview");
    assert.equal(history.value, 2);
  } finally {
    await sql`drop trigger if exists jobut_test_reject_notification on candidate_application_status_notifications`;
    await sql`drop function if exists jobut_test_reject_notification()`;
  }
  assert.equal(await reconcileCandidateApplicationStatusNotifications(ids.candidateA), "reconciled");
  assert.equal((await getCandidateApplicationNotifications(ids.candidateA, 1)).total, 2);
});
