import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { endDatabaseConnection } from "../../src/db";
import {
  AdminPackageError,
  createAdminPackage,
  deleteAdminPackage,
  updateAdminPackage,
} from "../../src/admin/packages";
import { publishJobPost, PublishJobError } from "../../src/jobs/publish";
import { confirmPackagePurchasePaid } from "../../src/packages/confirm-purchase";
import { processSepCallback } from "../../src/payments/callback";
import { PaymentError } from "../../src/payments/errors";
import { initiateSepPayment } from "../../src/payments/initiate";
import { SepProviderError } from "../../src/payments/sep/adapter";
import type { SepConfig } from "../../src/payments/sep/config";
import { getPublicPackageCatalog } from "../../src/packages/public-catalog";

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
  ambiguousPurchase: "50000000-0000-4000-8000-000000000002",
  ambiguousAttempt: "70000000-0000-4000-8000-000000000001",
  concurrentPurchase: "50000000-0000-4000-8000-000000000003",
  duplicatePurchase: "50000000-0000-4000-8000-000000000004",
  duplicateAttemptA: "70000000-0000-4000-8000-000000000002",
  duplicateAttemptB: "70000000-0000-4000-8000-000000000003",
  outOfOrderPurchase: "50000000-0000-4000-8000-000000000005",
  outOfOrderAttempt: "70000000-0000-4000-8000-000000000004",
  replayPurchase: "50000000-0000-4000-8000-000000000006",
  replayAttemptA: "70000000-0000-4000-8000-000000000005",
  replayAttemptB: "70000000-0000-4000-8000-000000000006",
  admin: "80000000-0000-4000-8000-000000000001",
};

const sepConfig: SepConfig = {
  appUrl: new URL("https://www.jobut.ir"),
  callbackUrl: new URL("https://www.jobut.ir/api/payments/sep/callback"),
  terminalId: "integration-terminal",
};

async function insertPurchase(id: string) {
  await sql`
    insert into package_purchases
      (id, company_id, job_package_id, package_name, job_credits, price_toman, status)
    values
      (${id}, ${ids.company}, ${ids.jobPackage}, 'Integration package', 1, 1000, 'pending')
  `;
}

async function insertAttempt(id: string, purchaseId: string) {
  await sql`
    insert into payment_attempts
      (id, package_purchase_id, provider, status, amount_rial, res_num)
    values (${id}, ${purchaseId}, 'SEP', 'redirect_ready', 10000, ${id})
  `;
}

before(async () => {
  await sql`truncate table employer_accounts, industries, admin_accounts cascade`;
  await sql`insert into industries (id, name, slug) values (${ids.industry}, 'Integration', 'integration')`;
  await sql`insert into employer_accounts (id, mobile) values (${ids.employer}, '+989120000001')`;
  await sql`insert into admin_accounts (id, email) values (${ids.admin}, 'package-owner@example.test')`;
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

test("ambiguous verification blocks another payment attempt", async () => {
  await insertPurchase(ids.ambiguousPurchase);
  await insertAttempt(ids.ambiguousAttempt, ids.ambiguousPurchase);

  const callback = await processSepCallback(
    {
      state: "OK",
      resNum: ids.ambiguousAttempt,
      refNum: "ambiguous-provider-reference",
      amountText: "10000",
    },
    sepConfig,
    async () => { throw new SepProviderError("provider_timeout"); },
  );
  assert.equal(callback.result, "review");

  const [attempt] = await sql`
    select status, failure_category from payment_attempts where id = ${ids.ambiguousAttempt}
  `;
  assert.deepEqual(attempt, {
    status: "reconciliation_required",
    failure_category: "provider_timeout",
  });

  await assert.rejects(
    initiateSepPayment(
      {
        purchaseId: ids.ambiguousPurchase,
        companyId: ids.company,
        employerMobile: "+989120000001",
        config: sepConfig,
      },
      async () => "must-not-request-a-token",
    ),
    (error: unknown) => error instanceof PaymentError
      && error.code === "PAYMENT_RECONCILIATION_REQUIRED",
  );
});

test("parallel initiation creates only one potentially payable attempt", async () => {
  await insertPurchase(ids.concurrentPurchase);
  const results = await Promise.allSettled([
    initiateSepPayment(
      {
        purchaseId: ids.concurrentPurchase,
        companyId: ids.company,
        employerMobile: null,
        config: sepConfig,
      },
      async () => "integration-token-a",
    ),
    initiateSepPayment(
      {
        purchaseId: ids.concurrentPurchase,
        companyId: ids.company,
        employerMobile: null,
        config: sepConfig,
      },
      async () => "integration-token-b",
    ),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const [attemptCount] = await sql`
    select count(*)::int as value from payment_attempts
    where package_purchase_id = ${ids.concurrentPurchase}
  `;
  assert.equal(attemptCount.value, 1);
});

test("two distinct verified settlements are preserved and credit is allocated once", async () => {
  await insertPurchase(ids.duplicatePurchase);
  await insertAttempt(ids.duplicateAttemptA, ids.duplicatePurchase);
  await insertAttempt(ids.duplicateAttemptB, ids.duplicatePurchase);

  const first = await processSepCallback(
    {
      state: "OK",
      resNum: ids.duplicateAttemptA,
      refNum: "provider-reference-a",
      amountText: "10000",
    },
    sepConfig,
    async () => ({ verified: true as const }),
  );
  const second = await processSepCallback(
    {
      state: "OK",
      resNum: ids.duplicateAttemptB,
      refNum: "provider-reference-b",
      amountText: "10000",
    },
    sepConfig,
    async () => ({ verified: true as const }),
  );
  const repeated = await processSepCallback(
    { state: null, resNum: ids.duplicateAttemptB, refNum: null, amountText: null },
    sepConfig,
    async () => { throw new Error("verified callbacks must not reverify"); },
  );

  assert.equal(first.result, "success");
  assert.equal(second.result, "review");
  assert.equal(repeated.result, "review");
  const attempts = await sql`
    select status, failure_category from payment_attempts
    where package_purchase_id = ${ids.duplicatePurchase}
    order by id
  `;
  assert.deepEqual(attempts, [
    { status: "verified", failure_category: null },
    { status: "verified", failure_category: "duplicate_settlement" },
  ]);
  const allocations = await sql`
    select amount from company_job_credit_transactions
    where package_purchase_id = ${ids.duplicatePurchase}
  `;
  assert.deepEqual(allocations.map((row) => row.amount), [1]);
});

test("a late valid OK callback can recover a previously failed attempt", async () => {
  await insertPurchase(ids.outOfOrderPurchase);
  await insertAttempt(ids.outOfOrderAttempt, ids.outOfOrderPurchase);

  const failed = await processSepCallback(
    { state: "Failed", resNum: ids.outOfOrderAttempt, refNum: null, amountText: null },
    sepConfig,
  );
  const recovered = await processSepCallback(
    {
      state: "OK",
      resNum: ids.outOfOrderAttempt,
      refNum: "late-valid-reference",
      amountText: "10000",
    },
    sepConfig,
    async () => ({ verified: true as const }),
  );

  assert.equal(failed.result, "failed");
  assert.equal(recovered.result, "success");
  const [attempt] = await sql`
    select status, ref_num from payment_attempts where id = ${ids.outOfOrderAttempt}
  `;
  assert.deepEqual(attempt, { status: "verified", ref_num: "late-valid-reference" });
});

test("a provider reference cannot be attached to two payment attempts", async () => {
  await insertPurchase(ids.replayPurchase);
  await insertAttempt(ids.replayAttemptA, ids.replayPurchase);
  await insertAttempt(ids.replayAttemptB, ids.replayPurchase);
  const sharedReference = "replayed-provider-reference";

  const first = await processSepCallback(
    {
      state: "OK",
      resNum: ids.replayAttemptA,
      refNum: sharedReference,
      amountText: "10000",
    },
    sepConfig,
    async () => ({ verified: true as const }),
  );
  const replay = await processSepCallback(
    {
      state: "OK",
      resNum: ids.replayAttemptB,
      refNum: sharedReference,
      amountText: "10000",
    },
    sepConfig,
    async () => ({ verified: true as const }),
  );

  assert.equal(first.result, "success");
  assert.equal(replay.result, "review");
  const attempts = await sql`
    select status, ref_num, failure_category from payment_attempts
    where id in (${ids.replayAttemptA}, ${ids.replayAttemptB}) order by id
  `;
  assert.deepEqual(attempts, [
    { status: "verified", ref_num: sharedReference, failure_category: null },
    {
      status: "reconciliation_required",
      ref_num: null,
      failure_category: "reference_or_amount_conflict",
    },
  ]);
});

test("Admin package mutation writes its audit event and protects stale edits", async () => {
  const packageId = await createAdminPackage(ids.admin, {
    name: "Admin integration package",
    priceToman: 20_000,
    jobCredits: 2,
    isActive: true,
    displayOrder: null,
    displayValidityText: null,
    paymentDescription: null,
    onlineCheckoutEnabled: true,
  });
  const [created] = await sql`
    select updated_at from job_packages where id = ${packageId}
  `;
  assert.equal((await getPublicPackageCatalog()).some((item) => item.id === packageId), true);
  await updateAdminPackage(ids.admin, packageId, created.updated_at, {
    name: "Admin integration package updated",
    priceToman: 30_000,
    jobCredits: 3,
    isActive: false,
    displayOrder: 10,
    displayValidityText: null,
    paymentDescription: "Paid online",
    onlineCheckoutEnabled: true,
  });
  const [afterEdit] = await sql`select updated_at from job_packages where id = ${packageId}`;
  await updateAdminPackage(ids.admin, packageId, afterEdit.updated_at, {
    name: "Admin integration package updated",
    priceToman: 30_000,
    jobCredits: 3,
    isActive: false,
    displayOrder: 10,
    displayValidityText: null,
    paymentDescription: "Paid online",
    onlineCheckoutEnabled: true,
  });
  await assert.rejects(
    updateAdminPackage(ids.admin, packageId, created.updated_at, {
      name: "Stale overwrite",
      priceToman: 1,
      jobCredits: 1,
      isActive: true,
      displayOrder: null,
      displayValidityText: null,
      paymentDescription: null,
      onlineCheckoutEnabled: true,
    }),
    (error: unknown) => error instanceof AdminPackageError && error.code === "STALE_UPDATE",
  );
  assert.equal((await getPublicPackageCatalog()).some((item) => item.id === packageId), false);

  const audit = await sql`
    select action, target_id from admin_audit_events
    where target_id = ${packageId} order by occurred_at
  `;
  assert.deepEqual(audit, [
    { action: "admin.packages.create", target_id: packageId },
    { action: "admin.packages.deactivate", target_id: packageId },
    { action: "admin.packages.update", target_id: packageId },
  ]);
});

test("an audit write failure rolls back the privileged package mutation", async () => {
  const name = "Must roll back with audit";
  await assert.rejects(createAdminPackage("90000000-0000-4000-8000-000000000099", {
    name,
    priceToman: 10_000,
    jobCredits: 1,
    isActive: true,
    displayOrder: null,
    displayValidityText: null,
    paymentDescription: null,
    onlineCheckoutEnabled: true,
  }));
  const [result] = await sql`
    select count(*)::int as value from job_packages where name = ${name}
  `;
  assert.equal(result.value, 0);
});

test("an audit failure rolls back an existing package edit", async () => {
  const packageId = await createAdminPackage(ids.admin, {
    name: "Edit rollback package",
    priceToman: 11_000,
    jobCredits: 1,
    isActive: true,
    displayOrder: null,
    displayValidityText: null,
    paymentDescription: null,
    onlineCheckoutEnabled: true,
  });
  const [before] = await sql`select updated_at from job_packages where id = ${packageId}`;
  await assert.rejects(updateAdminPackage(
    "90000000-0000-4000-8000-000000000099",
    packageId,
    before.updated_at,
    {
      name: "Must not persist",
      priceToman: 99_000,
      jobCredits: 9,
      isActive: false,
      displayOrder: 99,
      displayValidityText: "Must roll back",
      paymentDescription: "Must roll back",
      onlineCheckoutEnabled: false,
    },
  ));
  const [after] = await sql`
    select name, price_toman, job_credits from job_packages where id = ${packageId}
  `;
  assert.deepEqual(after, {
    name: "Edit rollback package",
    price_toman: 11_000,
    job_credits: 1,
  });
});

test("an unreferenced package is permanently deleted and its audit survives", async () => {
  const packageId = await createAdminPackage(ids.admin, {
    name: "Safe delete package",
    priceToman: 12_000,
    jobCredits: 1,
    isActive: true,
    displayOrder: null,
    displayValidityText: null,
    paymentDescription: null,
    onlineCheckoutEnabled: true,
  });
  const [current] = await sql`
    select name, updated_at from job_packages where id = ${packageId}
  `;
  await deleteAdminPackage(ids.admin, packageId, current.updated_at, current.name);
  await assert.rejects(
    deleteAdminPackage(ids.admin, packageId, current.updated_at, current.name),
    (error: unknown) => error instanceof AdminPackageError && error.code === "NOT_FOUND",
  );
  const [remaining] = await sql`
    select count(*)::int as value from job_packages where id = ${packageId}
  `;
  const [audit] = await sql`
    select action, target_id from admin_audit_events
    where target_id = ${packageId} and action = 'admin.packages.delete'
  `;
  assert.equal(remaining.value, 0);
  assert.deepEqual(audit, { action: "admin.packages.delete", target_id: packageId });
});

test("pending and paid purchase history permanently blocks package deletion", async () => {
  const packageId = await createAdminPackage(ids.admin, {
    name: "Protected delete package",
    priceToman: 13_000,
    jobCredits: 1,
    isActive: true,
    displayOrder: null,
    displayValidityText: null,
    paymentDescription: null,
    onlineCheckoutEnabled: true,
  });
  const [version] = await sql`select updated_at from job_packages where id = ${packageId}`;
  const [purchase] = await sql`
    insert into package_purchases
      (company_id, job_package_id, package_name, job_credits, price_toman, status)
    values
      (${ids.company}, ${packageId}, 'Protected snapshot', 1, 13000, 'pending')
    returning id
  `;
  for (const status of ["pending", "paid"] as const) {
    if (status === "paid") {
      await sql`update package_purchases set status = 'paid', paid_at = now() where id = ${purchase.id}`;
    }
    await assert.rejects(
      deleteAdminPackage(ids.admin, packageId, version.updated_at, "Protected delete package"),
      (error: unknown) => error instanceof AdminPackageError && error.code === "DELETE_BLOCKED",
    );
  }
  const [preserved] = await sql`
    select count(*)::int as value from package_purchases where id = ${purchase.id}
  `;
  assert.equal(preserved.value, 1);
});

test("concurrent purchase creation wins safely against permanent deletion", async () => {
  const packageId = await createAdminPackage(ids.admin, {
    name: "Concurrent delete package",
    priceToman: 14_000,
    jobCredits: 1,
    isActive: true,
    displayOrder: null,
    displayValidityText: null,
    paymentDescription: null,
    onlineCheckoutEnabled: true,
  });
  const [version] = await sql`select updated_at from job_packages where id = ${packageId}`;
  let signalLocked!: () => void;
  let releasePurchase!: () => void;
  const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
  const release = new Promise<void>((resolve) => { releasePurchase = resolve; });
  const purchase = sql.begin(async (transaction) => {
    await transaction`select id from job_packages where id = ${packageId} for share`;
    signalLocked();
    await release;
    await transaction`
      insert into package_purchases
        (company_id, job_package_id, package_name, job_credits, price_toman, status)
      values
        (${ids.company}, ${packageId}, 'Concurrent snapshot', 1, 14000, 'pending')
    `;
  });
  await locked;
  const deletion = assert.rejects(
    deleteAdminPackage(
      ids.admin,
      packageId,
      version.updated_at,
      "Concurrent delete package",
    ),
    (error: unknown) => error instanceof AdminPackageError && error.code === "DELETE_BLOCKED",
  );
  releasePurchase();
  await purchase;
  await deletion;
});
