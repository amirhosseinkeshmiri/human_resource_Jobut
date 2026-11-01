export const adminPermissions = [
  "admin.dashboard.read",
  "admin.employers.read",
  "admin.jobs.read",
  "admin.sales.read",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const adminPermissionSet = new Set<string>(adminPermissions);

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && adminPermissionSet.has(value);
}

export const ownerOnlyOperations = [
  "admin.accounts.create",
  "admin.accounts.status.manage",
  "admin.accounts.permissions.manage",
] as const;

export type OwnerOnlyOperation = (typeof ownerOnlyOperations)[number];

const ownerOnlyOperationSet = new Set<string>(ownerOnlyOperations);

export function isOwnerOnlyOperation(value: unknown): value is OwnerOnlyOperation {
  return typeof value === "string" && ownerOnlyOperationSet.has(value);
}
