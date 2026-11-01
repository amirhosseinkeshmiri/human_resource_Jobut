import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminManagementEnabled,
  isAdminAccountLoginEligible,
  shouldShowAdminManagementNavigation,
  isAdminManagementMutationAllowed,
} from "./admin-management-feature";

test("Admin management is disabled by default and only an explicit server environment enables it", () => {
  assert.equal(isAdminManagementEnabled({}), false);
  assert.equal(isAdminManagementEnabled({ ADMIN_RBAC_MANAGEMENT_ENABLED: "false" }), false);
  assert.equal(isAdminManagementEnabled({ ADMIN_RBAC_MANAGEMENT_ENABLED: "true" }), true);
});

test("Admin management navigation is visible only to an active owner while enabled", () => {
  assert.equal(shouldShowAdminManagementNavigation({ featureEnabled: true, status: "active", isOwner: true }), true);
  assert.equal(shouldShowAdminManagementNavigation({ featureEnabled: false, status: "active", isOwner: true }), false);
  assert.equal(shouldShowAdminManagementNavigation({ featureEnabled: true, status: "active", isOwner: false }), false);
  assert.equal(shouldShowAdminManagementNavigation({ featureEnabled: true, status: "disabled", isOwner: true }), false);
  assert.equal(shouldShowAdminManagementNavigation({ featureEnabled: true, status: null, isOwner: false }), false);
});

test("disabled Admin login is rejected once the migration-dependent feature is enabled", () => {
  assert.equal(isAdminAccountLoginEligible("active", true), true);
  assert.equal(isAdminAccountLoginEligible("disabled", true), false);
  assert.equal(isAdminAccountLoginEligible("disabled", false), true);
});

test("state-changing Admin management requires feature gate, trusted origin, and owner authorization", () => {
  assert.equal(isAdminManagementMutationAllowed({ featureEnabled: true, originTrusted: true, ownerAuthorized: true }), true);
  assert.equal(isAdminManagementMutationAllowed({ featureEnabled: false, originTrusted: true, ownerAuthorized: true }), false);
  assert.equal(isAdminManagementMutationAllowed({ featureEnabled: true, originTrusted: false, ownerAuthorized: true }), false);
  assert.equal(isAdminManagementMutationAllowed({ featureEnabled: true, originTrusted: true, ownerAuthorized: false }), false);
});
