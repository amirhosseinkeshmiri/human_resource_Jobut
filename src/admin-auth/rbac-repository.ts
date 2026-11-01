import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAccountPermissions,
  adminAccounts,
  adminAuditEvents,
  adminSessions,
  platformOwner,
} from "@/db/schema";
import type { AdminPermission } from "./permissions";

export type AdminAccountStatus = "active" | "disabled";
export type AdminAuditOutcome = "succeeded" | "failed" | "denied";

export interface AdminAccountRecord {
  id: string;
  status: AdminAccountStatus;
}

export interface OrdinaryAdminAccountRecord extends AdminAccountRecord {
  email: string | null;
  mobile: string | null;
  createdAt: Date;
}

export interface AdminAuditEventInput {
  actorAdminAccountId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  outcome: AdminAuditOutcome;
  metadataJson: Record<string, unknown>;
  correlationId: string;
  occurredAt?: Date;
}

export interface AdminRbacRepository {
  transaction<T>(callback: (repository: AdminRbacRepository) => Promise<T>): Promise<T>;
  findAccount(adminAccountId: string): Promise<AdminAccountRecord | null>;
  listOrdinaryAccounts(): Promise<OrdinaryAdminAccountRecord[]>;
  createOrdinaryAccount(identifier: { email: string | null; mobile: string | null }): Promise<string | null>;
  isPlatformOwner(adminAccountId: string): Promise<boolean>;
  listPermissions(adminAccountId: string): Promise<AdminPermission[]>;
  grantPermission(
    adminAccountId: string,
    permission: AdminPermission,
    grantedByAdminAccountId: string,
  ): Promise<boolean>;
  revokePermission(adminAccountId: string, permission: AdminPermission): Promise<boolean>;
  setAccountDisabled(
    adminAccountId: string,
    disabledByAdminAccountId: string,
    reason: string,
    disabledAt: Date,
  ): Promise<boolean>;
  setAccountActive(adminAccountId: string): Promise<boolean>;
  deleteSessions(adminAccountId: string): Promise<number>;
  insertAuditEvent(event: AdminAuditEventInput): Promise<void>;
}

type DbExecutor = Pick<typeof db, "select" | "insert" | "delete" | "update">;

function createDrizzleAdminRbacRepository(executor: DbExecutor): AdminRbacRepository {
  return {
    transaction: (callback) => db.transaction((transaction) =>
      callback(createDrizzleAdminRbacRepository(transaction as DbExecutor))),

    async findAccount(adminAccountId) {
      const [account] = await executor
        .select({ id: adminAccounts.id, status: adminAccounts.status })
        .from(adminAccounts)
        .where(eq(adminAccounts.id, adminAccountId))
        .limit(1);
      return account ?? null;
    },

    async listOrdinaryAccounts() {
      return executor
        .select({
          id: adminAccounts.id,
          email: adminAccounts.email,
          mobile: adminAccounts.mobile,
          status: adminAccounts.status,
          createdAt: adminAccounts.createdAt,
        })
        .from(adminAccounts)
        .leftJoin(platformOwner, eq(platformOwner.adminAccountId, adminAccounts.id))
        .where(isNull(platformOwner.adminAccountId))
        .orderBy(asc(adminAccounts.createdAt));
    },

    async createOrdinaryAccount(identifier) {
      try {
        const [created] = await executor
          .insert(adminAccounts)
          .values(identifier)
          .returning({ id: adminAccounts.id });
        return created?.id ?? null;
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
          return null;
        }
        throw error;
      }
    },

    async isPlatformOwner(adminAccountId) {
      const [owner] = await executor
        .select({ adminAccountId: platformOwner.adminAccountId })
        .from(platformOwner)
        .where(eq(platformOwner.adminAccountId, adminAccountId))
        .limit(1);
      return Boolean(owner);
    },

    async listPermissions(adminAccountId) {
      const rows = await executor
        .select({ permission: adminAccountPermissions.permissionCode })
        .from(adminAccountPermissions)
        .where(eq(adminAccountPermissions.adminAccountId, adminAccountId));
      return rows.map((row) => row.permission);
    },

    async grantPermission(adminAccountId, permission, grantedByAdminAccountId) {
      const inserted = await executor
        .insert(adminAccountPermissions)
        .values({ adminAccountId, permissionCode: permission, grantedByAdminAccountId })
        .onConflictDoNothing()
        .returning({ adminAccountId: adminAccountPermissions.adminAccountId });
      return inserted.length === 1;
    },

    async revokePermission(adminAccountId, permission) {
      const deleted = await executor
        .delete(adminAccountPermissions)
        .where(and(
          eq(adminAccountPermissions.adminAccountId, adminAccountId),
          eq(adminAccountPermissions.permissionCode, permission),
        ))
        .returning({ adminAccountId: adminAccountPermissions.adminAccountId });
      return deleted.length === 1;
    },

    async setAccountDisabled(adminAccountId, disabledByAdminAccountId, reason, disabledAt) {
      const updated = await executor
        .update(adminAccounts)
        .set({
          status: "disabled",
          disabledAt,
          disabledByAdminAccountId,
          disableReason: reason,
          updatedAt: disabledAt,
        })
        .where(eq(adminAccounts.id, adminAccountId))
        .returning({ id: adminAccounts.id });
      return updated.length === 1;
    },

    async setAccountActive(adminAccountId) {
      const updated = await executor
        .update(adminAccounts)
        .set({
          status: "active",
          disabledAt: null,
          disabledByAdminAccountId: null,
          disableReason: null,
          updatedAt: new Date(),
        })
        .where(eq(adminAccounts.id, adminAccountId))
        .returning({ id: adminAccounts.id });
      return updated.length === 1;
    },

    async deleteSessions(adminAccountId) {
      const deleted = await executor
        .delete(adminSessions)
        .where(eq(adminSessions.adminAccountId, adminAccountId))
        .returning({ id: adminSessions.id });
      return deleted.length;
    },

    async insertAuditEvent(event) {
      await executor.insert(adminAuditEvents).values({
        actorAdminAccountId: event.actorAdminAccountId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        outcome: event.outcome,
        metadataJson: event.metadataJson,
        correlationId: event.correlationId,
        occurredAt: event.occurredAt,
      });
    },
  };
}

export const adminRbacRepository = createDrizzleAdminRbacRepository(db);
