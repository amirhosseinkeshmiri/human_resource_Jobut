import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { createCandidateDataRequest, listCandidateDataRequests } from "../../src/candidate-data-requests/repository";
import { endDatabaseConnection } from "../../src/db";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.INTEGRATION_TESTS !== "1" || !parsedDatabaseUrl || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname) || parsedDatabaseUrl.pathname !== "/jobut_test") {
  throw new Error("Integration tests require an explicitly enabled local jobut_test database");
}

const sql = postgres(parsedDatabaseUrl.toString(), { max: 4, prepare: false });
const candidateA = "73000000-0000-4000-8000-000000000001";
const candidateB = "73000000-0000-4000-8000-000000000002";

before(async () => {
  await sql`truncate table candidate_accounts cascade`;
  await sql`insert into candidate_accounts (id, mobile) values (${candidateA}, '+989140000001'), (${candidateB}, '+989140000002')`;
});

after(async () => {
  await endDatabaseConnection();
  await sql.end();
});

test("concurrent duplicate submissions create one active request and one initial event", async () => {
  const results = await Promise.all([
    createCandidateDataRequest(candidateA, "personal_data_export"),
    createCandidateDataRequest(candidateA, "personal_data_export"),
  ]);
  assert.deepEqual(results.sort(), ["already-active", "created"]);
  const [counts] = await sql`select count(distinct r.id)::int as requests, count(e.id)::int as events from candidate_data_requests r left join candidate_data_request_status_events e on e.request_id = r.id where r.candidate_account_id = ${candidateA} and r.request_type = 'personal_data_export'`;
  assert.deepEqual(counts, { requests: 1, events: 1 });
});

test("request history is Candidate-owned and exposes no sensitive account data", async () => {
  await createCandidateDataRequest(candidateA, "account_deletion");
  const own = await listCandidateDataRequests(candidateA);
  const other = await listCandidateDataRequests(candidateB);
  assert.equal(own.length, 2);
  assert.equal(other.length, 0);
  assert.equal("candidateAccountId" in own[0]!, false);
  assert.equal("email" in own[0]!, false);
  assert.equal("mobile" in own[0]!, false);
});

test("status-event failure rolls back the request", async () => {
  await sql`create function jobut_test_reject_data_request_event() returns trigger language plpgsql as $$ begin raise exception 'test event failure'; end $$`;
  await sql`create trigger jobut_test_reject_data_request_event before insert on candidate_data_request_status_events for each row execute function jobut_test_reject_data_request_event()`;
  try {
    await assert.rejects(createCandidateDataRequest(candidateB, "account_deletion"));
    const [count] = await sql`select count(*)::int as value from candidate_data_requests where candidate_account_id = ${candidateB}`;
    assert.equal(count.value, 0);
  } finally {
    await sql`drop trigger if exists jobut_test_reject_data_request_event on candidate_data_request_status_events`;
    await sql`drop function if exists jobut_test_reject_data_request_event()`;
  }
});
