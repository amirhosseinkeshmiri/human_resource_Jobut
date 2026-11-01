import { randomUUID } from "node:crypto";
import { normalizeAuthIdentifier } from "@/auth/identifier";
import type { AdminAuthorizationContext } from "./authorization-policy";
import { isAdminPermission, type AdminPermission } from "./permissions";
import {
  adminRbacRepository,
  type AdminAccountStatus,
  type AdminAuditEventInput,
  type AdminRbacRepository,
} from "./rbac-repository";

const sensitiveAuditKey = /otp|password|token|secret|credential|cookie|session|authorization|email|mobile|phone|address|resume|profile|personal/i;
const auditActionPattern = /^[a-z][a-z0-9_.-]{0,99}$/;
const auditTargetTypePattern = /^[a-z][a-z0-9_.-]{0,79}$/;
const maxAuditMetadataBytes = 4_096;

export interface AdminDatabaseAuthorizationContext extends AdminAuthorizationContext {
  adminAccountId: string;
  status: AdminAccountStatus;
}

export type AdminRbacErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACTOR_NOT_ACTIVE"
  | "OWNER_REQUIRED"
  | "OWNER_ACCOUNT_PROTECTED"
  | "INVALID_PERMISSION"
  | "INVALID_DISABLE_REASON"
  | "INVALID_AUDIT_EVENT"
  | "UNSAFE_AUDIT_METADATA"
  | "INVALID_IDENTIFIER"
  | "DUPLICATE_IDENTIFIER";

export class AdminRbacError extends Error {
  constructor(public readonly code: AdminRbacErrorCode) {
    super(code);
    this.name = "AdminRbacError";
  }
}

function sanitizeAuditValue(value: unknown, depth: number): unknown {
  if (depth > 3) throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.length > 200) throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 20) throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
    return value.map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 20) throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
  return Object.fromEntries(entries.map(([key, item]) => {
    if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(key) || sensitiveAuditKey.test(key)) {
      throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
    }
    return [key, sanitizeAuditValue(item, depth + 1)];
  }));
}

export function sanitizeAdminAuditMetadata(metadata: unknown): Record<string, unknown> {
  const sanitized = sanitizeAuditValue(metadata, 0);
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== "object") {
    throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
  }
  if (Buffer.byteLength(JSON.stringify(sanitized), "utf8") > maxAuditMetadataBytes) {
    throw new AdminRbacError("UNSAFE_AUDIT_METADATA");
  }
  return sanitized as Record<string, unknown>;
}

export async function readAdminAuthorizationContext(
  adminAccountId: string,
  repository: AdminRbacRepository = adminRbacRepository,
): Promise<AdminDatabaseAuthorizationContext | null> {
  const account = await repository.findAccount(adminAccountId);
  if (!account) return null;
  const [isOwner, permissions] = await Promise.all([
    repository.isPlatformOwner(adminAccountId),
    repository.listPermissions(adminAccountId),
  ]);
  return {
    adminAccountId,
    status: account.status,
    isOwner: account.status === "active" && isOwner,
    permissions: new Set(account.status === "active" ? permissions : []),
  };
}

async function requireActiveOwner(repository: AdminRbacRepository, actorAdminAccountId: string) {
  const actor = await readAdminAuthorizationContext(actorAdminAccountId, repository);
  if (!actor) throw new AdminRbacError("ACCOUNT_NOT_FOUND");
  if (actor.status !== "active") throw new AdminRbacError("ACTOR_NOT_ACTIVE");
  if (!actor.isOwner) throw new AdminRbacError("OWNER_REQUIRED");
  return actor;
}

export async function listOrdinaryAdminAccounts(
  actorAdminAccountId: string,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    const accounts = await transaction.listOrdinaryAccounts();
    return Promise.all(accounts.map(async (account) => ({
      ...account,
      permissions: await transaction.listPermissions(account.id),
    })));
  });
}

export async function createOrdinaryAdminAccount(
  actorAdminAccountId: string,
  rawIdentifier: string,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  const identifier = normalizeAuthIdentifier(rawIdentifier);
  if (!identifier) throw new AdminRbacError("INVALID_IDENTIFIER");
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    const createdId = await transaction.createOrdinaryAccount({
      email: identifier.type === "email" ? identifier.value : null,
      mobile: identifier.type === "mobile" ? identifier.value : null,
    });
    if (!createdId) throw new AdminRbacError("DUPLICATE_IDENTIFIER");
    await appendMutationAudit(transaction, {
      actorAdminAccountId,
      action: "admin.accounts.create",
      targetType: "admin_account",
      targetId: createdId,
      outcome: "succeeded",
      metadata: { identifierType: identifier.type, initialPermissionCount: 0 },
    });
    return createdId;
  });
}

async function requireOrdinaryTarget(repository: AdminRbacRepository, targetAdminAccountId: string) {
  const target = await repository.findAccount(targetAdminAccountId);
  if (!target) throw new AdminRbacError("ACCOUNT_NOT_FOUND");
  if (await repository.isPlatformOwner(targetAdminAccountId)) {
    throw new AdminRbacError("OWNER_ACCOUNT_PROTECTED");
  }
  return target;
}

async function appendMutationAudit(
  repository: AdminRbacRepository,
  event: Omit<AdminAuditEventInput, "metadataJson" | "correlationId"> & {
    metadata?: unknown;
    correlationId?: string;
  },
) {
  await repository.insertAuditEvent({
    actorAdminAccountId: event.actorAdminAccountId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    outcome: event.outcome,
    metadataJson: sanitizeAdminAuditMetadata(event.metadata ?? {}),
    correlationId: event.correlationId ?? randomUUID(),
    occurredAt: event.occurredAt,
  });
}

export async function writeSanitizedAdminAuditEvent(
  event: Omit<AdminAuditEventInput, "metadataJson"> & { metadata?: unknown },
  repository: AdminRbacRepository = adminRbacRepository,
) {
  if (!auditActionPattern.test(event.action) || !auditTargetTypePattern.test(event.targetType)) {
    throw new AdminRbacError("INVALID_AUDIT_EVENT");
  }
  if (event.targetId !== undefined && event.targetId !== null && event.targetId.length > 160) {
    throw new AdminRbacError("INVALID_AUDIT_EVENT");
  }
  await repository.insertAuditEvent({
    ...event,
    targetId: event.targetId,
    metadataJson: sanitizeAdminAuditMetadata(event.metadata ?? {}),
  });
}

export async function grantAdminPermission(
  actorAdminAccountId: string,
  targetAdminAccountId: string,
  permission: AdminPermission,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  if (!isAdminPermission(permission)) throw new AdminRbacError("INVALID_PERMISSION");
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    await requireOrdinaryTarget(transaction, targetAdminAccountId);
    const changed = await transaction.grantPermission(
      targetAdminAccountId,
      permission,
      actorAdminAccountId,
    );
    await appendMutationAudit(transaction, {
      actorAdminAccountId,
      action: "admin.permissions.grant",
      targetType: "admin_account",
      targetId: targetAdminAccountId,
      outcome: "succeeded",
      metadata: { permissionCode: permission, changed },
    });
    return changed;
  });
}

export async function revokeAdminPermission(
  actorAdminAccountId: string,
  targetAdminAccountId: string,
  permission: AdminPermission,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  if (!isAdminPermission(permission)) throw new AdminRbacError("INVALID_PERMISSION");
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    await requireOrdinaryTarget(transaction, targetAdminAccountId);
    const changed = await transaction.revokePermission(targetAdminAccountId, permission);
    await appendMutationAudit(transaction, {
      actorAdminAccountId,
      action: "admin.permissions.revoke",
      targetType: "admin_account",
      targetId: targetAdminAccountId,
      outcome: "succeeded",
      metadata: { permissionCode: permission, changed },
    });
    return changed;
  });
}

export async function disableAdminAccount(
  actorAdminAccountId: string,
  targetAdminAccountId: string,
  reason: string,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 1 || normalizedReason.length > 500) {
    throw new AdminRbacError("INVALID_DISABLE_REASON");
  }
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    await requireOrdinaryTarget(transaction, targetAdminAccountId);
    const changed = await transaction.setAccountDisabled(
      targetAdminAccountId,
      actorAdminAccountId,
      normalizedReason,
      new Date(),
    );
    const revokedSessionCount = await transaction.deleteSessions(targetAdminAccountId);
    await appendMutationAudit(transaction, {
      actorAdminAccountId,
      action: "admin.accounts.disable",
      targetType: "admin_account",
      targetId: targetAdminAccountId,
      outcome: "succeeded",
      metadata: { changed, revokedCount: revokedSessionCount },
    });
    return { changed, revokedSessionCount };
  });
}

export async function enableAdminAccount(
  actorAdminAccountId: string,
  targetAdminAccountId: string,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    await requireOrdinaryTarget(transaction, targetAdminAccountId);
    const changed = await transaction.setAccountActive(targetAdminAccountId);
    await appendMutationAudit(transaction, {
      actorAdminAccountId,
      action: "admin.accounts.enable",
      targetType: "admin_account",
      targetId: targetAdminAccountId,
      outcome: "succeeded",
      metadata: { changed },
    });
    return changed;
  });
}

export async function revokeAdminAccountSessions(
  actorAdminAccountId: string,
  targetAdminAccountId: string,
  repository: AdminRbacRepository = adminRbacRepository,
) {
  return repository.transaction(async (transaction) => {
    await requireActiveOwner(transaction, actorAdminAccountId);
    await requireOrdinaryTarget(transaction, targetAdminAccountId);
    const revokedSessionCount = await transaction.deleteSessions(targetAdminAccountId);
    await appendMutationAudit(transaction, {
      actorAdminAccountId,
      action: "admin.sessions.revoke",
      targetType: "admin_account",
      targetId: targetAdminAccountId,
      outcome: "succeeded",
      metadata: { revokedCount: revokedSessionCount },
    });
    return revokedSessionCount;
  });
}
