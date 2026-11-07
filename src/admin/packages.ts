import "server-only";

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditEvents, jobPackages, packagePurchases } from "@/db/schema";
import { sanitizeAdminAuditMetadata } from "@/admin-auth/rbac-service";
import {
  isMatchingPackageVersion,
  nextPackageVersion,
  type AdminPackageInput,
} from "./package-policy";

export class AdminPackageError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "STALE_UPDATE" | "DELETE_BLOCKED" | "CONFIRMATION_MISMATCH") {
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
        paymentDescription: input.paymentDescription?.slice(0, 200) ?? null,
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
      .where(eq(jobPackages.id, packageId)).limit(1).for("update");
    if (!current) throw new AdminPackageError("NOT_FOUND");
    if (!isMatchingPackageVersion(current.updatedAt, expectedUpdatedAt)) {
      throw new AdminPackageError("STALE_UPDATE");
    }

    const updatedAt = nextPackageVersion(current.updatedAt);
    const [updated] = await transaction.update(jobPackages).set({ ...input, updatedAt })
      .where(eq(jobPackages.id, packageId))
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

export async function deleteAdminPackage(
  actorAdminAccountId: string,
  packageId: string,
  expectedUpdatedAt: Date,
  confirmedName: string,
) {
  return db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(jobPackages)
      .where(eq(jobPackages.id, packageId)).limit(1).for("update");
    if (!current) throw new AdminPackageError("NOT_FOUND");
    if (!isMatchingPackageVersion(current.updatedAt, expectedUpdatedAt)) {
      throw new AdminPackageError("STALE_UPDATE");
    }
    if (confirmedName !== current.name) {
      throw new AdminPackageError("CONFIRMATION_MISMATCH");
    }

    const [dependency] = await transaction.select({ id: packagePurchases.id })
      .from(packagePurchases)
      .where(eq(packagePurchases.jobPackageId, packageId))
      .limit(1);
    if (dependency) throw new AdminPackageError("DELETE_BLOCKED");

    const [deleted] = await transaction.delete(jobPackages)
      .where(eq(jobPackages.id, packageId))
      .returning({ id: jobPackages.id });
    if (!deleted) throw new AdminPackageError("NOT_FOUND");

    await insertAudit(transaction, {
      actorAdminAccountId,
      action: "admin.packages.delete",
      targetId: current.id,
      metadata: {
        snapshot: {
          name: current.name,
          priceToman: current.priceToman,
          jobCredits: current.jobCredits,
          isActive: current.isActive,
          displayOrder: current.displayOrder,
          displayValidityText: current.displayValidityText,
          paymentDescription: current.paymentDescription?.slice(0, 200) ?? null,
          onlineCheckoutEnabled: current.onlineCheckoutEnabled,
          createdAt: current.createdAt.toISOString(),
          updatedAt: current.updatedAt.toISOString(),
        },
      },
    });
  });
}
