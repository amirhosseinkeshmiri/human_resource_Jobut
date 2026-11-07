import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditEvents, jobPackages } from "@/db/schema";
import { sanitizeAdminAuditMetadata } from "@/admin-auth/rbac-service";
import type { AdminPackageInput } from "./package-policy";

export class AdminPackageError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "STALE_UPDATE") {
    super(code);
    this.name = "AdminPackageError";
  }
}

export function listAdminPackages() {
  return db.select().from(jobPackages).orderBy(desc(jobPackages.createdAt));
}

async function insertAudit(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    actorAdminAccountId: string;
    action: string;
    targetId: string;
    metadata: Record<string, unknown>;
  },
) {
  await transaction.insert(adminAuditEvents).values({
    actorAdminAccountId: input.actorAdminAccountId,
    action: input.action,
    targetType: "job_package",
    targetId: input.targetId,
    outcome: "succeeded",
    metadataJson: sanitizeAdminAuditMetadata(input.metadata),
    correlationId: randomUUID(),
  });
}

export async function createAdminPackage(actorAdminAccountId: string, input: AdminPackageInput) {
  return db.transaction(async (transaction) => {
    const [created] = await transaction.insert(jobPackages).values(input).returning({
      id: jobPackages.id,
    });
    await insertAudit(transaction, {
      actorAdminAccountId,
      action: "admin.packages.create",
      targetId: created.id,
      metadata: {
        name: input.name,
        priceToman: input.priceToman,
        jobCredits: input.jobCredits,
        isActive: input.isActive,
        displayOrder: input.displayOrder,
        displayValidityText: input.displayValidityText,
        paymentDescription: input.paymentDescription,
        onlineCheckoutEnabled: input.onlineCheckoutEnabled,
      },
    });
    return created.id;
  });
}

export async function updateAdminPackage(
  actorAdminAccountId: string,
  packageId: string,
  expectedUpdatedAt: Date,
  input: AdminPackageInput,
) {
  return db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(jobPackages)
      .where(eq(jobPackages.id, packageId)).limit(1);
    if (!current) throw new AdminPackageError("NOT_FOUND");

    const now = new Date();
    const [updated] = await transaction.update(jobPackages).set({ ...input, updatedAt: now })
      .where(and(eq(jobPackages.id, packageId), eq(jobPackages.updatedAt, expectedUpdatedAt)))
      .returning({ id: jobPackages.id });
    if (!updated) throw new AdminPackageError("STALE_UPDATE");

    const changedFields = (Object.keys(input) as Array<keyof AdminPackageInput>)
      .filter((key) => current[key] !== input[key]);
    const action = current.isActive !== input.isActive
      ? input.isActive ? "admin.packages.activate" : "admin.packages.deactivate"
      : "admin.packages.update";
    await insertAudit(transaction, {
      actorAdminAccountId,
      action,
      targetId: packageId,
      metadata: {
        changedFields,
        previousName: current.name,
        newName: input.name,
        previousPriceToman: current.priceToman,
        newPriceToman: input.priceToman,
        previousJobCredits: current.jobCredits,
        newJobCredits: input.jobCredits,
        previousIsActive: current.isActive,
        newIsActive: input.isActive,
        previousDisplayOrder: current.displayOrder,
        newDisplayOrder: input.displayOrder,
        previousOnlineCheckoutEnabled: current.onlineCheckoutEnabled,
        newOnlineCheckoutEnabled: input.onlineCheckoutEnabled,
      },
    });
  });
}
