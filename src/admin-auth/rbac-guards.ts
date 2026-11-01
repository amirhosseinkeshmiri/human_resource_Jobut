import "server-only";

import { notFound, redirect } from "next/navigation";
import { createAdminRbacRequestGuards } from "./rbac-guard-core";
import { readAdminAuthorizationContext } from "./rbac-service";
import { getCurrentAdmin } from "./session";

export type { ActiveAdminPrincipal } from "./rbac-guard-core";

/**
 * These guards require migration 0018 because authorization is loaded from
 * admin_accounts.status, platform_owner, and admin_account_permissions.
 */
const productionGuards = createAdminRbacRequestGuards({
  getAuthenticatedAdmin: getCurrentAdmin,
  loadAuthorizationContext: readAdminAuthorizationContext,
  redirectToLogin: () => redirect("/admin/login"),
  denyAccess: () => notFound(),
});

export const requireActiveAdmin = productionGuards.requireActiveAdmin;
export const requireSuperAdmin = productionGuards.requireSuperAdmin;
export const requireAdminPermission = productionGuards.requireAdminPermission;
export const requireOwnerOnlyOperation = productionGuards.requireOwnerOnlyOperation;
