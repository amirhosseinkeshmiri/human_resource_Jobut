import assert from "node:assert/strict";
import test from "node:test";
import type { AdminPermission } from "./permissions";
import type {
  AdminAccountRecord,
  AdminAuditEventInput,
  AdminRbacRepository,
} from "./rbac-repository";
import {
  AdminRbacError,
  createOrdinaryAdminAccount,
  disableAdminAccount,
  enableAdminAccount,
  grantAdminPermission,
  readAdminAuthorizationContext,
  revokeAdminAccountSessions,
  revokeAdminPermission,
  sanitizeAdminAuditMetadata,
  writeSanitizedAdminAuditEvent,
} from "./rbac-service";

const ownerId = "10000000-0000-4000-8000-000000000001";
const adminId = "10000000-0000-4000-8000-000000000002";

class MemoryAdminRbacRepository implements AdminRbacRepository {
  accounts = new Map<string, AdminAccountRecord>([
    [ownerId, { id: ownerId, status: "active" }],
    [adminId, { id: adminId, status: "active" }],
  ]);
  ownerId: string | null = ownerId;
  permissions = new Map<string, Set<AdminPermission>>();
  sessions = new Map([[ownerId, 1], [adminId, 2]]);
  audits: AdminAuditEventInput[] = [];
  transactions = 0;
  ordinaryAccounts: Array<{
    id: string; email: string | null; mobile: string | null;
    status: "active" | "disabled"; createdAt: Date;
  }> = [];

  async transaction<T>(callback: (repository: AdminRbacRepository) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return callback(this);
  }
  async findAccount(id: string) {
    return this.accounts.get(id) ?? null;
  }
  async listOrdinaryAccounts() {
    return this.ordinaryAccounts;
  }
  async createOrdinaryAccount(identifier: { email: string | null; mobile: string | null }) {
    if (this.ordinaryAccounts.some((account) =>
      account.email === identifier.email && account.mobile === identifier.mobile)) return null;
    const id = "10000000-0000-4000-8000-000000000003";
    this.accounts.set(id, { id, status: "active" });
    this.ordinaryAccounts.push({ id, ...identifier, status: "active", createdAt: new Date() });
    return id;
  }
  async isPlatformOwner(id: string) {
    return id === this.ownerId;
  }
  async listPermissions(id: string) {
    return [...(this.permissions.get(id) ?? [])];
  }
  async grantPermission(id: string, permission: AdminPermission) {
    const permissions = this.permissions.get(id) ?? new Set<AdminPermission>();
    const changed = !permissions.has(permission);
    permissions.add(permission);
    this.permissions.set(id, permissions);
    return changed;
  }
  async revokePermission(id: string, permission: AdminPermission) {
    return this.permissions.get(id)?.delete(permission) ?? false;
  }
  async setAccountDisabled(id: string) {
    const account = this.accounts.get(id);
    if (!account) return false;
    account.status = "disabled";
    return true;
  }
  async setAccountActive(id: string) {
    const account = this.accounts.get(id);
    if (!account) return false;
    account.status = "active";
    return true;
  }
  async deleteSessions(id: string) {
    const count = this.sessions.get(id) ?? 0;
    this.sessions.set(id, 0);
    return count;
  }
  async insertAuditEvent(event: AdminAuditEventInput) {
    this.audits.push(event);
  }
}

async function expectRbacError(operation: () => Promise<unknown>, code: AdminRbacError["code"]) {
  await assert.rejects(operation, (error) => error instanceof AdminRbacError && error.code === code);
}

test("authorization context is database-backed and disabled accounts receive no permissions", async () => {
  const repository = new MemoryAdminRbacRepository();
  repository.permissions.set(adminId, new Set(["admin.jobs.read"]));

  assert.deepEqual(await readAdminAuthorizationContext(adminId, repository), {
    adminAccountId: adminId,
    status: "active",
    isOwner: false,
    permissions: new Set(["admin.jobs.read"]),
  });
  repository.accounts.get(adminId)!.status = "disabled";
  const disabledContext = await readAdminAuthorizationContext(adminId, repository);
  assert.deepEqual(disabledContext?.permissions, new Set());
  assert.equal(disabledContext?.isOwner, false);
  assert.equal(await readAdminAuthorizationContext("missing", repository), null);
});

test("only an active database owner can grant or revoke catalog permissions", async () => {
  const repository = new MemoryAdminRbacRepository();

  await expectRbacError(
    () => grantAdminPermission(adminId, ownerId, "admin.jobs.read", repository),
    "OWNER_REQUIRED",
  );
  assert.equal(repository.permissions.size, 0);

  assert.equal(await grantAdminPermission(ownerId, adminId, "admin.jobs.read", repository), true);
  assert.equal(await grantAdminPermission(ownerId, adminId, "admin.jobs.read", repository), false);
  assert.equal(await revokeAdminPermission(ownerId, adminId, "admin.jobs.read", repository), true);
  assert.equal(repository.transactions, 4);
  assert.equal(repository.audits.length, 3);
});

test("owner creates a normalized ordinary Admin with zero permissions and audit", async () => {
  const repository = new MemoryAdminRbacRepository();
  const id = await createOrdinaryAdminAccount(ownerId, " New.Admin@Example.COM ", repository);
  assert.equal(repository.ordinaryAccounts[0]?.email, "new.admin@example.com");
  assert.deepEqual(await repository.listPermissions(id), []);
  assert.deepEqual(repository.audits[0]?.metadataJson, {
    identifierType: "email",
    initialPermissionCount: 0,
  });
  await expectRbacError(
    () => createOrdinaryAdminAccount(ownerId, "new.admin@example.com", repository),
    "DUPLICATE_IDENTIFIER",
  );
});

test("unknown permissions and attempts to modify the owner fail closed", async () => {
  const repository = new MemoryAdminRbacRepository();

  await expectRbacError(
    () => grantAdminPermission(ownerId, adminId, "admin.unknown" as AdminPermission, repository),
    "INVALID_PERMISSION",
  );
  await expectRbacError(
    () => grantAdminPermission(ownerId, ownerId, "admin.jobs.read", repository),
    "OWNER_ACCOUNT_PROTECTED",
  );
  await expectRbacError(
    () => disableAdminAccount(ownerId, ownerId, "not allowed", repository),
    "OWNER_ACCOUNT_PROTECTED",
  );
  assert.equal(repository.audits.length, 0);
});

test("disabling an ordinary Admin revokes sessions and audits in one transaction", async () => {
  const repository = new MemoryAdminRbacRepository();

  assert.deepEqual(
    await disableAdminAccount(ownerId, adminId, "  policy violation  ", repository),
    { changed: true, revokedSessionCount: 2 },
  );
  assert.equal(repository.accounts.get(adminId)?.status, "disabled");
  assert.equal(repository.sessions.get(adminId), 0);
  assert.equal(repository.transactions, 1);
  assert.deepEqual(repository.audits[0]?.metadataJson, {
    changed: true,
    revokedCount: 2,
  });
});

test("enabling and explicit session revocation remain owner-only and audited", async () => {
  const repository = new MemoryAdminRbacRepository();
  repository.accounts.get(adminId)!.status = "disabled";

  assert.equal(await enableAdminAccount(ownerId, adminId, repository), true);
  repository.sessions.set(adminId, 3);
  assert.equal(await revokeAdminAccountSessions(ownerId, adminId, repository), 3);
  assert.equal(repository.audits.length, 2);

  repository.accounts.get(ownerId)!.status = "disabled";
  await expectRbacError(
    () => enableAdminAccount(ownerId, adminId, repository),
    "ACTOR_NOT_ACTIVE",
  );
});

test("audit metadata rejects secrets, personal records, excessive depth, and oversized values", () => {
  assert.deepEqual(sanitizeAdminAuditMetadata({ permissionCode: "admin.jobs.read", changed: true }), {
    permissionCode: "admin.jobs.read",
    changed: true,
  });
  for (const metadata of [
    { otp: "123456" },
    { sessionToken: "secret" },
    { email: "person@example.com" },
    { profile: { name: "Complete Person" } },
    { nested: { one: { two: { three: { four: true } } } } },
    { value: "x".repeat(201) },
  ]) {
    assert.throws(
      () => sanitizeAdminAuditMetadata(metadata),
      (error) => error instanceof AdminRbacError && error.code === "UNSAFE_AUDIT_METADATA",
    );
  }
});

test("standalone audit writing validates action shape and stores only sanitized metadata", async () => {
  const repository = new MemoryAdminRbacRepository();
  await writeSanitizedAdminAuditEvent({
    actorAdminAccountId: ownerId,
    action: "admin.test.succeeded",
    targetType: "admin_account",
    targetId: adminId,
    outcome: "succeeded",
    correlationId: "20000000-0000-4000-8000-000000000001",
    metadata: { changed: true },
  }, repository);
  assert.deepEqual(repository.audits[0]?.metadataJson, { changed: true });

  await expectRbacError(
    () => writeSanitizedAdminAuditEvent({
      actorAdminAccountId: ownerId,
      action: "Invalid action",
      targetType: "admin_account",
      outcome: "failed",
      correlationId: "20000000-0000-4000-8000-000000000001",
    }, repository),
    "INVALID_AUDIT_EVENT",
  );
});
