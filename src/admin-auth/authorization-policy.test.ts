import assert from "node:assert/strict";
import test from "node:test";
import {
  adminPageAccessPolicy,
  adminPages,
  canAccessAdminPage,
  canPerformOwnerOnlyOperation,
  hasAdminPermission,
  isAdminAccessAllowed,
  type AdminAuthorizationContext,
} from "./authorization-policy";
import {
  adminPermissions,
  isAdminPermission,
  isOwnerOnlyOperation,
  ownerOnlyOperations,
  type AdminPermission,
} from "./permissions";

function ordinaryAdmin(...permissions: AdminPermission[]): AdminAuthorizationContext {
  return { isOwner: false, permissions: new Set(permissions) };
}

const owner: AdminAuthorizationContext = {
  isOwner: true,
  permissions: new Set(),
};

test("permission and owner-only catalogs recognize only declared values", () => {
  for (const permission of adminPermissions) assert.equal(isAdminPermission(permission), true);
  for (const operation of ownerOnlyOperations) assert.equal(isOwnerOnlyOperation(operation), true);

  assert.equal(isAdminPermission("admin.everything"), false);
  assert.equal(isAdminPermission(undefined), false);
  assert.equal(isOwnerOnlyOperation("admin.dashboard.read"), false);
  assert.equal(isOwnerOnlyOperation(null), false);
});

test("every current Admin page has one explicit assignable permission", () => {
  assert.deepEqual(Object.keys(adminPageAccessPolicy).sort(), [...adminPages].sort());
  for (const page of adminPages) {
    assert.equal(isAdminPermission(adminPageAccessPolicy[page]), true);
  }
});

test("ordinary Administrators receive only explicitly assigned page access", () => {
  const employersReader = ordinaryAdmin("admin.employers.read");

  assert.equal(canAccessAdminPage(employersReader, "employers"), true);
  assert.equal(canAccessAdminPage(employersReader, "dashboard"), false);
  assert.equal(canAccessAdminPage(employersReader, "jobs"), false);
  assert.equal(canAccessAdminPage(employersReader, "sales"), false);
});

test("missing or empty authorization contexts deny access by default", () => {
  const noPermissions = ordinaryAdmin();

  for (const permission of adminPermissions) {
    assert.equal(hasAdminPermission(noPermissions, permission), false);
    assert.equal(hasAdminPermission(null, permission), false);
    assert.equal(hasAdminPermission(undefined, permission), false);
  }
  for (const page of adminPages) {
    assert.equal(canAccessAdminPage(noPermissions, page), false);
    assert.equal(canAccessAdminPage(null, page), false);
  }
});

test("the platform owner can access all permission-protected Admin pages", () => {
  for (const page of adminPages) assert.equal(canAccessAdminPage(owner, page), true);
  for (const permission of adminPermissions) assert.equal(hasAdminPermission(owner, permission), true);
});

test("owner-only operations cannot be granted through ordinary permissions", () => {
  const allPermissions = ordinaryAdmin(...adminPermissions);

  for (const operation of ownerOnlyOperations) {
    assert.equal(canPerformOwnerOnlyOperation(allPermissions, operation), false);
    assert.equal(isAdminAccessAllowed(allPermissions, { kind: "owner", operation }), false);
    assert.equal(canPerformOwnerOnlyOperation(owner, operation), true);
    assert.equal(isAdminAccessAllowed(owner, { kind: "owner", operation }), true);
  }
});

test("generic access evaluation preserves permission and owner boundaries", () => {
  const jobsReader = ordinaryAdmin("admin.jobs.read");

  assert.equal(
    isAdminAccessAllowed(jobsReader, { kind: "permission", permission: "admin.jobs.read" }),
    true,
  );
  assert.equal(
    isAdminAccessAllowed(jobsReader, { kind: "permission", permission: "admin.sales.read" }),
    false,
  );
  assert.equal(
    isAdminAccessAllowed(null, { kind: "owner", operation: "admin.accounts.create" }),
    false,
  );
});

test("runtime values outside the catalogs remain denied", () => {
  const forgedPermission = "admin.everything" as AdminPermission;
  const forgedContext: AdminAuthorizationContext = {
    isOwner: false,
    permissions: new Set([forgedPermission]),
  };

  assert.equal(hasAdminPermission(forgedContext, forgedPermission), false);
  assert.equal(
    canPerformOwnerOnlyOperation(owner, "admin.owner.replace" as never),
    false,
  );
});
