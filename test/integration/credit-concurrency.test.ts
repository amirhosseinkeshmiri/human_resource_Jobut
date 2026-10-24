import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { endDatabaseConnection } from "../../src/db";
import { publishJobPost, PublishJobError } from "../../src/jobs/publish";
import { confirmPackagePurchasePaid } from "../../src/packages/confirm-purchase";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
if (
  process.env.INTEGRATION_TESTS !== "1"
  || !parsedDatabaseUrl
  || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname)
  || parsedDatabaseUrl.pathname !== "/jobut_test"
) {
  throw new Error("Integration tests require an explicitly enabled local jobut_test database");
}

const sql = postgres(parsedDatabaseUrl.toString(), { max: 4, prepare: false });

const ids = {
  industry: "10000000-0000-4000-8000-000000000001",
  employer: "20000000-0000-4000-8000-000000000001",
  company: "30000000-0000-4000-8000-000000000001",
  jobPackage: "40000000-0000-4000-8000-000000000001",
  purchase: "50000000-0000-4000-8000-000000000001",
  firstJob: "60000000-0000-4000-8000-000000000001",
  secondJob: "60000000-0000-4000-8000-000000000002",
};

before(async () => {
  await sql`truncate table employer_accounts, industries cascade`;
  await sql`insert into industries (id, name, slug) values (${ids.industry}, 'Integration', 'integration')`;
  await sql`insert into employer_accounts (id, mobile) values (${ids.employer}, '+989120000001')`;
  await sql`
    insert into companies (id, employer_account_id, industry_id, name, address, founding_year)
    values (${ids.company}, ${ids.employer}, ${ids.industry}, 'Integration Company', 'Test only', 1400)
  `;
  await sql`
    insert into job_packages (id, name, job_credits, price_toman)
    values (${ids.jobPackage}, 'Integration package', 1, 1000)
  `;
});

after(async () => {
  await endDatabaseConnection();
  await sql.end();
});

test("concurrent payment confirmations allocate package credit exactly once", async () => {
  await sql`
    insert into package_purchases
      (id, company_id, job_package_id, package_name, job_credits, price_toman, status)
    values
      (${ids.purchase}, ${ids.company}, ${ids.jobPackage}, 'Integration package', 1, 1000, 'pending')
  `;

  const results = await Promise.all([
    confirmPackagePurchasePaid(ids.purchase),
    confirmPackagePurchasePaid(ids.purchase),
  ]);

  assert.deepEqual(results.map((result) => result.allocated).sort(), [false, true]);
  const [purchase] = await sql`
    select status, paid_at from package_purchases where id = ${ids.purchase}
  `;
  const allocations = await sql`
    select amount from company_job_credit_transactions where package_purchase_id = ${ids.purchase}
  `;
  assert.equal(purchase.status, "paid");
  assert.ok(purchase.paid_at);
  assert.deepEqual(allocations.map((row) => row.amount), [1]);
});

test("concurrent publications cannot consume the same final credit twice", async () => {
  for (const id of [ids.firstJob, ids.secondJob]) {
    await sql`
      insert into job_posts
        (id, company_id, title, status, workplace_type, employment_type, location,
         seniority_level, salary_min, salary_max, salary_negotiable, required_skills, description)
      values
        (${id}, ${ids.company}, 'Integration Job', 'draft', 'hybrid', 'full_time', 'Tehran',
         'mid_level', 1000, 2000, false, array['TypeScript'], '<p>Integration job description</p>')
    `;
  }

  const results = await Promise.allSettled([
    publishJobPost(ids.company, ids.firstJob),
    publishJobPost(ids.company, ids.secondJob),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(
    rejected[0].status === "rejected"
      && rejected[0].reason instanceof PublishJobError
      && rejected[0].reason.code === "insufficient-credit",
  );

  const jobs = await sql`
    select status from job_posts where id in (${ids.firstJob}, ${ids.secondJob}) order by id
  `;
  assert.deepEqual(jobs.map((row) => row.status).sort(), ["draft", "published"]);
  const [balance] = await sql`
    select coalesce(sum(amount), 0)::int as value
    from company_job_credit_transactions
    where company_id = ${ids.company}
  `;
  assert.equal(balance.value, 0);
});
