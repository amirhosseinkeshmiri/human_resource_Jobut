import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import postgres from "postgres";

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
  owner: "a1000000-0000-4000-8000-000000000001",
  ordinary: "a1000000-0000-4000-8000-000000000002",
  other: "a1000000-0000-4000-8000-000000000003",
  missing: "a1000000-0000-4000-8000-000000000099",
  challenge: "a2000000-0000-4000-8000-000000000001",
  session: "a3000000-0000-4000-8000-000000000001",
  audit: "a4000000-0000-4000-8000-000000000001",
  correlation: "a5000000-0000-4000-8000-000000000001",
};

async function expectPostgresError(
  operation: () => Promise<unknown>,
  expectedCode: string,
) {
  await assert.rejects(operation, (error: unknown) => {
    return typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === expectedCode;
  });
}

async function insertAdmins() {
  await sql`
    insert into admin_accounts (id, email)
    values
      (${ids.owner}, 'owner-integration@example.com'),
      (${ids.ordinary}, 'ordinary-integration@example.com'),
      (${ids.other}, 'other-integration@example.com')
  `;
}

beforeEach(async () => {
  await sql`
    truncate table
      admin_audit_events,
      platform_owner,
      admin_account_permissions,
      admin_auth_challenges,
      admin_sessions,
      admin_accounts
    cascade
  `;
});

after(async () => {
  await sql.end();
});

test("migration exposes the RBAC schema without provisioning owners or permissions", async () => {
  const relations = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('platform_owner', 'admin_account_permissions', 'admin_audit_events')
    order by table_name
  `;
  assert.deepEqual(relations.map((row) => row.table_name), [
    "admin_account_permissions",
    "admin_audit_events",
    "platform_owner",
  ]);

  await insertAdmins();
  const [counts] = await sql`
    select
      (select count(*)::int from platform_owner) as owners,
      (select count(*)::int from admin_account_permissions) as permissions
  `;
  assert.deepEqual(counts, { owners: 0, permissions: 0 });
});

test("legacy-style Admin inserts remain active and authentication records remain intact", async () => {
  await sql`insert into admin_accounts (id, email) values (${ids.ordinary}, 'legacy-integration@example.com')`;
  await sql`
    insert into admin_auth_challenges
      (id, identifier, identifier_type, code_digest, expires_at)
    values
      (${ids.challenge}, 'legacy-integration@example.com', 'email', ${"0".repeat(64)}, now() + interval '10 minutes')
  `;
  await sql`
    insert into admin_sessions (id, admin_account_id, token_digest, expires_at)
    values (${ids.session}, ${ids.ordinary}, ${"1".repeat(64)}, now() + interval '30 days')
  `;

  const [account] = await sql`
    select email, status, disabled_at, disabled_by_admin_account_id, disable_reason
    from admin_accounts where id = ${ids.ordinary}
  `;
  const [related] = await sql`
    select
      (select count(*)::int from admin_auth_challenges where id = ${ids.challenge}) as challenges,
      (select count(*)::int from admin_sessions where id = ${ids.session}) as sessions
  `;
  assert.deepEqual(account, {
    email: "legacy-integration@example.com",
    status: "active",
    disabled_at: null,
    disabled_by_admin_account_id: null,
    disable_reason: null,
  });
  assert.deepEqual(related, { challenges: 1, sessions: 1 });
});

test("platform owner is a protected singleton", async () => {
  await insertAdmins();
  await sql`
    insert into platform_owner (admin_account_id, provisioned_by_reference)
    values (${ids.owner}, 'integration-test-change-reference')
  `;

  await expectPostgresError(
    () => sql`insert into platform_owner (admin_account_id, provisioned_by_reference) values (${ids.other}, 'second-owner')`,
    "23505",
  );
  await expectPostgresError(
    () => sql`insert into platform_owner (singleton_key, admin_account_id, provisioned_by_reference) values (false, ${ids.other}, 'invalid-key')`,
    "23514",
  );
  await expectPostgresError(
    () => sql`delete from admin_accounts where id = ${ids.owner}`,
    "23503",
  );

  const [owner] = await sql`select admin_account_id from platform_owner`;
  assert.equal(owner.admin_account_id, ids.owner);
});

test("permission assignments accept only catalog values, valid accounts, and unique grants", async () => {
  await insertAdmins();
  await sql`
    insert into admin_account_permissions
      (admin_account_id, permission_code, granted_by_admin_account_id)
    values
      (${ids.ordinary}, 'admin.jobs.read', ${ids.owner})
  `;

  await expectPostgresError(
    () => sql`
      insert into admin_account_permissions
        (admin_account_id, permission_code, granted_by_admin_account_id)
      values
        (${ids.ordinary}, (${"admin.unknown"}::text)::admin_permission_code, ${ids.owner})
    `,
    "22P02",
  );
  await expectPostgresError(
    () => sql`
      insert into admin_account_permissions
        (admin_account_id, permission_code, granted_by_admin_account_id)
      values
        (${ids.ordinary}, 'admin.jobs.read', ${ids.owner})
    `,
    "23505",
  );
  await expectPostgresError(
    () => sql`
      insert into admin_account_permissions
        (admin_account_id, permission_code, granted_by_admin_account_id)
      values
        (${ids.missing}, 'admin.sales.read', ${ids.owner})
    `,
    "23503",
  );
  await expectPostgresError(
    () => sql`
      insert into admin_account_permissions
        (admin_account_id, permission_code, granted_by_admin_account_id)
      values
        (${ids.other}, 'admin.sales.read', ${ids.missing})
    `,
    "23503",
  );

  const permissions = await sql`select permission_code from admin_account_permissions`;
  assert.deepEqual(permissions, [{ permission_code: "admin.jobs.read" }]);
});

test("Admin account status requires complete and internally consistent disable attribution", async () => {
  await insertAdmins();

  await expectPostgresError(
    () => sql`update admin_accounts set status = 'disabled' where id = ${ids.ordinary}`,
    "23514",
  );
  await expectPostgresError(
    () => sql`update admin_accounts set status = (${"suspended"}::text)::admin_account_status where id = ${ids.ordinary}`,
    "22P02",
  );

  await sql`
    update admin_accounts
    set
      status = 'disabled',
      disabled_at = now(),
      disabled_by_admin_account_id = ${ids.owner},
      disable_reason = 'Integration test disable reason'
    where id = ${ids.ordinary}
  `;
  const [disabled] = await sql`
    select status, disabled_at is not null as has_disabled_at,
      disabled_by_admin_account_id, disable_reason
    from admin_accounts where id = ${ids.ordinary}
  `;
  assert.deepEqual(disabled, {
    status: "disabled",
    has_disabled_at: true,
    disabled_by_admin_account_id: ids.owner,
    disable_reason: "Integration test disable reason",
  });

  await expectPostgresError(
    () => sql`update admin_accounts set status = 'active' where id = ${ids.ordinary}`,
    "23514",
  );
});

test("audit actor references preserve durable historical attribution", async () => {
  await insertAdmins();
  await sql`
    insert into admin_audit_events
      (id, actor_admin_account_id, action, target_type, target_id, outcome, correlation_id, metadata_json)
    values
      (${ids.audit}, ${ids.owner}, 'admin.permissions.grant', 'admin_account', ${ids.ordinary},
       'succeeded', ${ids.correlation}, ${sql.json({ permissionCode: "admin.jobs.read" })})
  `;

  await expectPostgresError(
    () => sql`delete from admin_accounts where id = ${ids.owner}`,
    "23503",
  );
  const [event] = await sql`
    select actor_admin_account_id, action, target_id, outcome, metadata_json
    from admin_audit_events where id = ${ids.audit}
  `;
  assert.deepEqual(event, {
    actor_admin_account_id: ids.owner,
    action: "admin.permissions.grant",
    target_id: ids.ordinary,
    outcome: "succeeded",
    metadata_json: { permissionCode: "admin.jobs.read" },
  });
});

test("the additive SQL migration preserves a pre-existing Admin, challenge, and session", async () => {
  const migrationDatabase = "jobut_rbac_migration_test";
  const maintenance = postgres(parsedDatabaseUrl.toString(), { max: 1, prepare: false });
  const migrationUrl = new URL(parsedDatabaseUrl.toString());
  migrationUrl.pathname = `/${migrationDatabase}`;

  await maintenance.unsafe(`drop database if exists ${migrationDatabase} with (force)`);
  await maintenance.unsafe(`create database ${migrationDatabase}`);
  const migrationSql = postgres(migrationUrl.toString(), { max: 1, prepare: false });
  try {
    for (const filename of ["0005_nosy_blindfold.sql", "0018_giant_tana_nile.sql"]) {
      const contents = await readFile(path.join(process.cwd(), "drizzle", filename), "utf8");
      for (const statement of contents.split("--> statement-breakpoint")) {
        if (statement.trim()) await migrationSql.unsafe(statement);
      }
      if (filename === "0005_nosy_blindfold.sql") {
        await migrationSql`insert into admin_accounts (id, email) values (${ids.ordinary}, 'before-rbac@example.com')`;
        await migrationSql`
          insert into admin_auth_challenges
            (id, identifier, identifier_type, code_digest, expires_at)
          values
            (${ids.challenge}, 'before-rbac@example.com', 'email', ${"2".repeat(64)}, now() + interval '10 minutes')
        `;
        await migrationSql`
          insert into admin_sessions (id, admin_account_id, token_digest, expires_at)
          values (${ids.session}, ${ids.ordinary}, ${"3".repeat(64)}, now() + interval '30 days')
        `;
      }
    }

    const [result] = await migrationSql`
      select
        (select email from admin_accounts where id = ${ids.ordinary}) as email,
        (select status from admin_accounts where id = ${ids.ordinary}) as status,
        (select count(*)::int from admin_auth_challenges where id = ${ids.challenge}) as challenges,
        (select count(*)::int from admin_sessions where id = ${ids.session}) as sessions,
        (select count(*)::int from platform_owner) as owners,
        (select count(*)::int from admin_account_permissions) as permissions
    `;
    assert.deepEqual(result, {
      email: "before-rbac@example.com",
      status: "active",
      challenges: 1,
      sessions: 1,
      owners: 0,
      permissions: 0,
    });
  } finally {
    await migrationSql.end();
    await maintenance.unsafe(`drop database if exists ${migrationDatabase} with (force)`);
    await maintenance.end();
  }
});
