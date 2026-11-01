import postgres from "postgres";
import {
  bootstrapPlatformOwner,
  designatedPlatformOwnerEmail,
  OwnerBootstrapError,
  ownerBootstrapConfirmation,
  type OwnerBootstrapTransaction,
} from "../src/admin-auth/bootstrap-owner";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is required");

const input = {
  adminAccountId: argument("admin-account-id") ?? "",
  expectedEmail: argument("expected-email") ?? "",
  confirmation: argument("confirm") ?? "",
  operatorReference: argument("operator-reference") ?? "",
  authorizationReference: argument("authorization-reference") ?? "",
  identityVerificationReference: argument("identity-verification-reference") ?? "",
};

if (input.expectedEmail.trim().toLowerCase() !== designatedPlatformOwnerEmail) {
  fail("The explicit expected email does not match the designated owner");
}
if (input.confirmation !== ownerBootstrapConfirmation) {
  fail(`Execution requires --confirm ${ownerBootstrapConfirmation}`);
}

const connectionUrl = new URL(databaseUrl);
connectionUrl.searchParams.set("application_name", "jobut_platform_owner_bootstrap");
const sql = postgres(connectionUrl.toString(), {
  max: 1,
  prepare: false,
  connect_timeout: 10,
});

try {
  const result = await bootstrapPlatformOwner(input, {
    withLockedTransaction: <T>(callback: (transaction: OwnerBootstrapTransaction) => Promise<T>) => sql.begin(async (transactionSql) => {
      await transactionSql`
        select pg_advisory_xact_lock(
          hashtextextended('jobut.platform_owner.bootstrap', 0)
        )
      `;
      const transaction: OwnerBootstrapTransaction = {
        async findExistingOwner() {
          const [owner] = await transactionSql`
            select admin_account_id from platform_owner limit 1
          `;
          return owner ? { adminAccountId: owner.admin_account_id as string } : null;
        },
        async findAdminAccountForUpdate(adminAccountId) {
          const [account] = await transactionSql`
            select id, email, status
            from admin_accounts
            where id = ${adminAccountId}
            for update
          `;
          return account ? {
            id: account.id as string,
            email: account.email as string | null,
            status: account.status as "active" | "disabled",
          } : null;
        },
        async insertPlatformOwner(owner) {
          await transactionSql`
            insert into platform_owner
              (singleton_key, admin_account_id, provisioned_at, provisioned_by_reference)
            values
              (true, ${owner.adminAccountId}, ${owner.provisionedAt}, ${owner.provisionedByReference})
          `;
        },
        async revokeAdminSessions(adminAccountId) {
          const deleted = await transactionSql`
            delete from admin_sessions
            where admin_account_id = ${adminAccountId}
            returning id
          `;
          return deleted.length;
        },
        async insertBootstrapAuditEvent(event) {
          await transactionSql`
            insert into admin_audit_events
              (actor_admin_account_id, action, target_type, target_id, outcome,
               metadata_json, correlation_id, occurred_at)
            values
              (null, 'platform_owner.bootstrap', 'admin_account', ${event.targetAdminAccountId},
               'succeeded', ${JSON.stringify(event.metadata)}::jsonb, ${event.correlationId}, ${event.occurredAt})
          `;
        },
      };
      return callback(transaction);
    }) as Promise<T>,
  });
  console.log(JSON.stringify({
    event: "platform_owner_bootstrap_succeeded",
    correlationId: result.correlationId,
    revokedSessionCount: result.revokedSessionCount,
  }));
} catch (error) {
  const code = error instanceof OwnerBootstrapError ? error.code : "DATABASE_OPERATION_FAILED";
  console.error(JSON.stringify({ event: "platform_owner_bootstrap_failed", code }));
  process.exitCode = 1;
} finally {
  await sql.end();
}
