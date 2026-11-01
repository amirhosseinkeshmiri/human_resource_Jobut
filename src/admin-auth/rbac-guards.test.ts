import assert from "node:assert/strict";
import test from "node:test";
import type { AdminDatabaseAuthorizationContext } from "./rbac-service";
import { createAdminRbacRequestGuards } from "./rbac-guard-core";

class GuardSignal extends Error {
  constructor(readonly kind: "login" | "denied") {
    super(kind);
  }
}

function context(
  options: Partial<AdminDatabaseAuthorizationContext> = {},
): AdminDatabaseAuthorizationContext {
  return {
    adminAccountId: "10000000-0000-4000-8000-000000000001",
    status: "active",
    isOwner: false,
    permissions: new Set(),
    ...options,
  };
}

function createHarness(options: {
  authenticatedAdminId?: string | null;
  authorizationContext?: AdminDatabaseAuthorizationContext | null;
} = {}) {
  let sessionReads = 0;
  let authorizationReads = 0;
  const authenticatedAdminId = options.authenticatedAdminId === undefined
    ? "10000000-0000-4000-8000-000000000001"
    : options.authenticatedAdminId;
  const authorizationContext = options.authorizationContext === undefined
    ? context()
    : options.authorizationContext;

  const guards = createAdminRbacRequestGuards({
    async getAuthenticatedAdmin() {
      sessionReads += 1;
      return authenticatedAdminId ? { id: authenticatedAdminId } : null;
    },
    async loadAuthorizationContext() {
      authorizationReads += 1;
      return authorizationContext;
    },
    redirectToLogin() {
      throw new GuardSignal("login");
    },
    denyAccess() {
      throw new GuardSignal("denied");
    },
  });

  return {
    guards,
    reads: () => ({ sessionReads, authorizationReads }),
  };
}

async function expectSignal(operation: () => Promise<unknown>, kind: GuardSignal["kind"]) {
  await assert.rejects(
    operation,
    (error) => error instanceof GuardSignal && error.kind === kind,
  );
}

test("anonymous and expired or invalid Admin sessions redirect to the existing login page", async () => {
  for (const authenticatedAdminId of [null, null]) {
    const { guards, reads } = createHarness({ authenticatedAdminId });
    await expectSignal(() => guards.requireActiveAdmin(), "login");
    assert.deepEqual(reads(), { sessionReads: 1, authorizationReads: 0 });
  }
});

test("deleted and disabled Admin accounts fail closed after valid session resolution", async () => {
  const deleted = createHarness({ authorizationContext: null });
  await expectSignal(() => deleted.guards.requireActiveAdmin(), "login");

  const disabled = createHarness({
    authorizationContext: context({ status: "disabled", permissions: new Set() }),
  });
  await expectSignal(() => disabled.guards.requireActiveAdmin(), "login");
  assert.deepEqual(disabled.reads(), { sessionReads: 1, authorizationReads: 1 });
});

test("active ordinary Admin resolves a fresh database-backed principal", async () => {
  const authorizationContext = context({ permissions: new Set(["admin.jobs.read"]) });
  const { guards, reads } = createHarness({ authorizationContext });

  assert.equal(await guards.requireActiveAdmin(), authorizationContext);
  assert.deepEqual(reads(), { sessionReads: 1, authorizationReads: 1 });
});

test("ordinary Admin requires an assigned permission and revoked access is denied", async () => {
  const allowed = createHarness({
    authorizationContext: context({ permissions: new Set(["admin.jobs.read"]) }),
  });
  await allowed.guards.requireAdminPermission("admin.jobs.read");
  await expectSignal(
    () => allowed.guards.requireAdminPermission("admin.sales.read"),
    "denied",
  );

  const revoked = createHarness({ authorizationContext: context({ permissions: new Set() }) });
  await expectSignal(
    () => revoked.guards.requireAdminPermission("admin.jobs.read"),
    "denied",
  );
});

test("Super Admin is identified only by fresh owner membership", async () => {
  const ordinary = createHarness();
  await expectSignal(() => ordinary.guards.requireSuperAdmin(), "denied");

  const ownerContext = context({ isOwner: true });
  const owner = createHarness({ authorizationContext: ownerContext });
  assert.equal(await owner.guards.requireSuperAdmin(), ownerContext);
  assert.equal(await owner.guards.requireAdminPermission("admin.sales.read"), ownerContext);
});

test("unknown permissions deny before database authorization lookup", async () => {
  const { guards, reads } = createHarness({
    authorizationContext: context({ isOwner: true }),
  });
  await expectSignal(
    () => guards.requireAdminPermission("admin.unknown" as never),
    "denied",
  );
  assert.deepEqual(reads(), { sessionReads: 0, authorizationReads: 0 });
});

test("ordinary permissions cannot authorize owner-only operations", async () => {
  const allOrdinaryPermissions = new Set([
    "admin.dashboard.read",
    "admin.employers.read",
    "admin.jobs.read",
    "admin.sales.read",
  ] as const);
  const ordinary = createHarness({
    authorizationContext: context({ permissions: allOrdinaryPermissions }),
  });
  await expectSignal(
    () => ordinary.guards.requireOwnerOnlyOperation("admin.accounts.permissions.manage"),
    "denied",
  );
});

test("one resolved principal can be safely reused without duplicate request lookups", async () => {
  const { guards, reads } = createHarness({
    authorizationContext: context({
      isOwner: true,
      permissions: new Set(["admin.jobs.read"]),
    }),
  });
  const principal = await guards.requireActiveAdmin();
  await guards.requireSuperAdmin(principal);
  await guards.requireAdminPermission("admin.jobs.read", principal);
  await guards.requireOwnerOnlyOperation("admin.accounts.status.manage", principal);
  assert.deepEqual(reads(), { sessionReads: 1, authorizationReads: 1 });
});
