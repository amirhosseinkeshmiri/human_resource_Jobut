import "server-only";

import { randomUUID } from "node:crypto";
import { normalizeAuthIdentifier } from "@/auth/identifier";
import { sanitizeAdminAuditMetadata } from "./rbac-service";

export const designatedPlatformOwnerEmail = "amir.h6334@gmail.com";
export const ownerBootstrapConfirmation = "PROVISION_JOBUT_PLATFORM_OWNER";

export type OwnerBootstrapErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CONFIRMATION"
  | "TARGET_NOT_FOUND"
  | "TARGET_DISABLED"
  | "EMAIL_MISMATCH"
  | "OWNER_ALREADY_EXISTS";

export class OwnerBootstrapError extends Error {
  constructor(public readonly code: OwnerBootstrapErrorCode) {
    super(code);
    this.name = "OwnerBootstrapError";
  }
}

export interface OwnerBootstrapInput {
  adminAccountId: string;
  expectedEmail: string;
  confirmation: string;
  operatorReference: string;
  authorizationReference: string;
  identityVerificationReference: string;
}

interface BootstrapAdminAccount {
  id: string;
  email: string | null;
  status: "active" | "disabled";
}

export interface OwnerBootstrapTransaction {
  findExistingOwner(): Promise<{ adminAccountId: string } | null>;
  findAdminAccountForUpdate(adminAccountId: string): Promise<BootstrapAdminAccount | null>;
  insertPlatformOwner(input: {
    adminAccountId: string;
    provisionedAt: Date;
    provisionedByReference: string;
  }): Promise<void>;
  revokeAdminSessions(adminAccountId: string): Promise<number>;
  insertBootstrapAuditEvent(input: {
    targetAdminAccountId: string;
    correlationId: string;
    occurredAt: Date;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export interface OwnerBootstrapRepository {
  withLockedTransaction<T>(
    callback: (transaction: OwnerBootstrapTransaction) => Promise<T>,
  ): Promise<T>;
}

function normalizedEmail(value: string | null) {
  if (value === null) return null;
  const normalized = normalizeAuthIdentifier(value);
  return normalized?.type === "email" ? normalized.value : null;
}

function validateReference(value: string) {
  const normalized = value.trim();
  if (
    !/^[a-z0-9][a-z0-9._:/-]{2,199}$/i.test(normalized)
    || /otp|password|token|secret|credential|cookie|session/i.test(normalized)
    || /\d{6}/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export async function bootstrapPlatformOwner(
  input: OwnerBootstrapInput,
  repository: OwnerBootstrapRepository,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.adminAccountId)) {
    throw new OwnerBootstrapError("INVALID_INPUT");
  }
  if (input.confirmation !== ownerBootstrapConfirmation) {
    throw new OwnerBootstrapError("INVALID_CONFIRMATION");
  }
  const expectedEmail = normalizedEmail(input.expectedEmail);
  if (expectedEmail !== designatedPlatformOwnerEmail) {
    throw new OwnerBootstrapError("INVALID_INPUT");
  }
  const operatorReference = validateReference(input.operatorReference);
  const authorizationReference = validateReference(input.authorizationReference);
  const identityVerificationReference = validateReference(input.identityVerificationReference);
  if (!operatorReference || !authorizationReference || !identityVerificationReference) {
    throw new OwnerBootstrapError("INVALID_INPUT");
  }

  return repository.withLockedTransaction(async (transaction) => {
    if (await transaction.findExistingOwner()) {
      throw new OwnerBootstrapError("OWNER_ALREADY_EXISTS");
    }
    const target = await transaction.findAdminAccountForUpdate(input.adminAccountId);
    if (!target) throw new OwnerBootstrapError("TARGET_NOT_FOUND");
    if (target.status !== "active") throw new OwnerBootstrapError("TARGET_DISABLED");
    if (normalizedEmail(target.email) !== expectedEmail) {
      throw new OwnerBootstrapError("EMAIL_MISMATCH");
    }

    const occurredAt = new Date();
    const correlationId = randomUUID();
    await transaction.insertPlatformOwner({
      adminAccountId: target.id,
      provisionedAt: occurredAt,
      provisionedByReference: authorizationReference,
    });
    const revokedCount = await transaction.revokeAdminSessions(target.id);
    await transaction.insertBootstrapAuditEvent({
      targetAdminAccountId: target.id,
      correlationId,
      occurredAt,
      metadata: sanitizeAdminAuditMetadata({
        operatorReference,
        changeReference: authorizationReference,
        identityVerificationReference,
        revokedCount,
      }),
    });
    return { correlationId, revokedSessionCount: revokedCount };
  });
}
