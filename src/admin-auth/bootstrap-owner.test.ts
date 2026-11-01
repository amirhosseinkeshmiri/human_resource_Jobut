import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapPlatformOwner,
  designatedPlatformOwnerEmail,
  OwnerBootstrapError,
  ownerBootstrapConfirmation,
  type OwnerBootstrapRepository,
  type OwnerBootstrapTransaction,
} from "./bootstrap-owner";

const targetId = "10000000-0000-4000-8000-000000000001";

function validInput() {
  return {
    adminAccountId: targetId,
    expectedEmail: designatedPlatformOwnerEmail,
    confirmation: ownerBootstrapConfirmation,
    operatorReference: "operator-record-42",
    authorizationReference: "approved-change-42",
    identityVerificationReference: "controlled-identity-check-42",
  };
}

class MemoryBootstrapRepository implements OwnerBootstrapRepository {
  account: { id: string; email: string | null; status: "active" | "disabled" } | null = {
    id: targetId,
    email: designatedPlatformOwnerEmail,
    status: "active",
  };
  ownerId: string | null = null;
  sessions = 2;
  audits: Array<{ targetAdminAccountId: string; metadata: Record<string, unknown> }> = [];
  failAudit = false;
  private queue: Promise<void> = Promise.resolve();

  async withLockedTransaction<T>(callback: (transaction: OwnerBootstrapTransaction) => Promise<T>) {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const snapshot = {
      ownerId: this.ownerId,
      sessions: this.sessions,
      audits: [...this.audits],
    };
    try {
      return await callback({
        findExistingOwner: async () => this.ownerId ? { adminAccountId: this.ownerId } : null,
        findAdminAccountForUpdate: async (id) => this.account?.id === id ? this.account : null,
        insertPlatformOwner: async ({ adminAccountId }) => { this.ownerId = adminAccountId; },
        revokeAdminSessions: async () => {
          const count = this.sessions;
          this.sessions = 0;
          return count;
        },
        insertBootstrapAuditEvent: async (event) => {
          if (this.failAudit) throw new Error("simulated audit failure");
          this.audits.push({
            targetAdminAccountId: event.targetAdminAccountId,
            metadata: event.metadata,
          });
        },
      });
    } catch (error) {
      this.ownerId = snapshot.ownerId;
      this.sessions = snapshot.sessions;
      this.audits = snapshot.audits;
      throw error;
    } finally {
      release();
    }
  }
}

async function expectBootstrapError(
  operation: () => Promise<unknown>,
  code: OwnerBootstrapError["code"],
) {
  await assert.rejects(
    operation,
    (error) => error instanceof OwnerBootstrapError && error.code === code,
  );
}

test("invalid or missing target account fails without mutation", async () => {
  const repository = new MemoryBootstrapRepository();
  repository.account = null;
  await expectBootstrapError(
    () => bootstrapPlatformOwner(validInput(), repository),
    "TARGET_NOT_FOUND",
  );
  assert.equal(repository.ownerId, null);
  assert.equal(repository.sessions, 2);
});

test("disabled target account cannot become owner", async () => {
  const repository = new MemoryBootstrapRepository();
  repository.account!.status = "disabled";
  await expectBootstrapError(
    () => bootstrapPlatformOwner(validInput(), repository),
    "TARGET_DISABLED",
  );
  assert.equal(repository.ownerId, null);
});

test("normalized target email must match the explicit designated email", async () => {
  const repository = new MemoryBootstrapRepository();
  repository.account!.email = "another-admin@example.com";
  await expectBootstrapError(
    () => bootstrapPlatformOwner(validInput(), repository),
    "EMAIL_MISMATCH",
  );

  repository.account!.email = "  AMIR.H6334@GMAIL.COM ";
  const result = await bootstrapPlatformOwner(validInput(), repository);
  assert.equal(typeof result.correlationId, "string");
});

test("existing owner makes repeated execution fail without changing owner", async () => {
  const repository = new MemoryBootstrapRepository();
  repository.ownerId = "20000000-0000-4000-8000-000000000002";
  await expectBootstrapError(
    () => bootstrapPlatformOwner(validInput(), repository),
    "OWNER_ALREADY_EXISTS",
  );
  assert.equal(repository.ownerId, "20000000-0000-4000-8000-000000000002");
  assert.equal(repository.audits.length, 0);
});

test("successful provisioning inserts one owner, revokes sessions, and writes sanitized audit", async () => {
  const repository = new MemoryBootstrapRepository();
  const result = await bootstrapPlatformOwner(validInput(), repository);

  assert.equal(repository.ownerId, targetId);
  assert.equal(repository.sessions, 0);
  assert.equal(result.revokedSessionCount, 2);
  assert.deepEqual(repository.audits, [{
    targetAdminAccountId: targetId,
    metadata: {
      operatorReference: "operator-record-42",
      changeReference: "approved-change-42",
      identityVerificationReference: "controlled-identity-check-42",
      revokedCount: 2,
    },
  }]);
});

test("concurrent attempts serialize and exactly one can provision", async () => {
  const repository = new MemoryBootstrapRepository();
  const results = await Promise.allSettled([
    bootstrapPlatformOwner(validInput(), repository),
    bootstrapPlatformOwner(validInput(), repository),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(
    rejected?.status === "rejected" && rejected.reason instanceof OwnerBootstrapError
      ? rejected.reason.code
      : null,
    "OWNER_ALREADY_EXISTS",
  );
  assert.equal(repository.ownerId, targetId);
  assert.equal(repository.audits.length, 1);
});

test("audit failure rolls back owner insertion and session revocation", async () => {
  const repository = new MemoryBootstrapRepository();
  repository.failAudit = true;
  await assert.rejects(() => bootstrapPlatformOwner(validInput(), repository));
  assert.equal(repository.ownerId, null);
  assert.equal(repository.sessions, 2);
  assert.equal(repository.audits.length, 0);
});

test("explicit confirmation and designated expected email are mandatory", async () => {
  const repository = new MemoryBootstrapRepository();
  await expectBootstrapError(
    () => bootstrapPlatformOwner({ ...validInput(), confirmation: "yes" }, repository),
    "INVALID_CONFIRMATION",
  );
  await expectBootstrapError(
    () => bootstrapPlatformOwner({ ...validInput(), expectedEmail: "owner@example.com" }, repository),
    "INVALID_INPUT",
  );
  assert.equal(repository.ownerId, null);
});
