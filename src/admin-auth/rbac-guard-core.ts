import "server-only";

import { canPerformOwnerOnlyOperation, hasAdminPermission } from "./authorization-policy";
import {
  isAdminPermission,
  type AdminPermission,
  type OwnerOnlyOperation,
} from "./permissions";
import type { AdminDatabaseAuthorizationContext } from "./rbac-service";

export type ActiveAdminPrincipal = AdminDatabaseAuthorizationContext & {
  status: "active";
};

export interface AdminRbacGuardDependencies {
  getAuthenticatedAdmin(): Promise<{ id: string } | null>;
  loadAuthorizationContext(adminAccountId: string): Promise<AdminDatabaseAuthorizationContext | null>;
  redirectToLogin(): never;
  denyAccess(): never;
}

export function createAdminRbacRequestGuards(dependencies: AdminRbacGuardDependencies) {
  async function resolveActivePrincipal(): Promise<ActiveAdminPrincipal> {
    const authenticatedAdmin = await dependencies.getAuthenticatedAdmin();
    if (!authenticatedAdmin) return dependencies.redirectToLogin();

    const context = await dependencies.loadAuthorizationContext(authenticatedAdmin.id);
    if (!context || context.status !== "active") return dependencies.redirectToLogin();
    return context as ActiveAdminPrincipal;
  }

  async function requireActiveAdmin(principal?: ActiveAdminPrincipal) {
    return principal ?? resolveActivePrincipal();
  }

  async function requireSuperAdmin(principal?: ActiveAdminPrincipal) {
    const resolved = await requireActiveAdmin(principal);
    if (!resolved.isOwner) return dependencies.denyAccess();
    return resolved;
  }

  async function requireAdminPermission(
    permission: AdminPermission,
    principal?: ActiveAdminPrincipal,
  ) {
    if (!isAdminPermission(permission)) return dependencies.denyAccess();
    const resolved = await requireActiveAdmin(principal);
    if (!hasAdminPermission(resolved, permission)) return dependencies.denyAccess();
    return resolved;
  }

  async function requireOwnerOnlyOperation(
    operation: OwnerOnlyOperation,
    principal?: ActiveAdminPrincipal,
  ) {
    const resolved = await requireActiveAdmin(principal);
    if (!canPerformOwnerOnlyOperation(resolved, operation)) return dependencies.denyAccess();
    return resolved;
  }

  return {
    requireActiveAdmin,
    requireSuperAdmin,
    requireAdminPermission,
    requireOwnerOnlyOperation,
  };
}
