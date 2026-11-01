import {
  isAdminPermission,
  isOwnerOnlyOperation,
  type AdminPermission,
  type OwnerOnlyOperation,
} from "./permissions";

export const adminPages = ["dashboard", "employers", "jobs", "sales"] as const;

export type AdminPage = (typeof adminPages)[number];

export const adminPageAccessPolicy = {
  dashboard: "admin.dashboard.read",
  employers: "admin.employers.read",
  jobs: "admin.jobs.read",
  sales: "admin.sales.read",
} as const satisfies Record<AdminPage, AdminPermission>;

export interface AdminAuthorizationContext {
  isOwner: boolean;
  permissions: ReadonlySet<AdminPermission>;
}

export type AdminAccessRequirement =
  | { kind: "permission"; permission: AdminPermission }
  | { kind: "owner"; operation: OwnerOnlyOperation };

export function hasAdminPermission(
  context: AdminAuthorizationContext | null | undefined,
  permission: AdminPermission,
) {
  return Boolean(
    isAdminPermission(permission) &&
    context &&
    (context.isOwner || context.permissions.has(permission)),
  );
}

export function canPerformOwnerOnlyOperation(
  context: AdminAuthorizationContext | null | undefined,
  operation: OwnerOnlyOperation,
) {
  return isOwnerOnlyOperation(operation) && context?.isOwner === true;
}

export function isAdminAccessAllowed(
  context: AdminAuthorizationContext | null | undefined,
  requirement: AdminAccessRequirement,
) {
  switch (requirement.kind) {
    case "permission":
      return hasAdminPermission(context, requirement.permission);
    case "owner":
      return canPerformOwnerOnlyOperation(context, requirement.operation);
    default:
      return false;
  }
}

export function canAccessAdminPage(
  context: AdminAuthorizationContext | null | undefined,
  page: AdminPage,
) {
  return hasAdminPermission(context, adminPageAccessPolicy[page]);
}
