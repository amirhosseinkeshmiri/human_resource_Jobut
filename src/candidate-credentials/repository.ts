import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateAccounts,
  candidateCredentialDocuments,
  candidateCredentials,
} from "@/db/schema";
import { MAX_CANDIDATE_CREDENTIALS, type CandidateCredentialValues } from "./validation";

export async function listCandidateCredentials(candidateAccountId: string) {
  return db.select({
    id: candidateCredentials.id,
    recordType: candidateCredentials.recordType,
    title: candidateCredentials.title,
    issuer: candidateCredentials.issuer,
    issueDate: candidateCredentials.issueDate,
    expirationDate: candidateCredentials.expirationDate,
    credentialId: candidateCredentials.credentialId,
    verificationUrl: candidateCredentials.verificationUrl,
    description: candidateCredentials.description,
    updatedAt: candidateCredentials.updatedAt,
    hasDocument: sql<boolean>`${candidateCredentialDocuments.credentialId} is not null`,
  }).from(candidateCredentials)
    .leftJoin(candidateCredentialDocuments, eq(candidateCredentialDocuments.credentialId, candidateCredentials.id))
    .where(eq(candidateCredentials.candidateAccountId, candidateAccountId))
    .orderBy(desc(candidateCredentials.issueDate), desc(candidateCredentials.createdAt));
}

export async function createCandidateCredential(candidateAccountId: string, values: CandidateCredentialValues) {
  return db.transaction(async (transaction) => {
    await transaction.select({ id: candidateAccounts.id }).from(candidateAccounts)
      .where(eq(candidateAccounts.id, candidateAccountId)).limit(1).for("update");
    const [count] = await transaction.select({ value: sql<number>`count(*)::int` })
      .from(candidateCredentials).where(eq(candidateCredentials.candidateAccountId, candidateAccountId));
    if ((count?.value ?? 0) >= MAX_CANDIDATE_CREDENTIALS) throw new Error("CREDENTIAL_LIMIT");
    const [record] = await transaction.insert(candidateCredentials)
      .values({ candidateAccountId, ...values }).returning({ id: candidateCredentials.id });
    return record;
  });
}

export async function updateCandidateCredential(candidateAccountId: string, credentialId: string, values: CandidateCredentialValues) {
  const [record] = await db.update(candidateCredentials).set({ ...values, updatedAt: new Date() })
    .where(and(eq(candidateCredentials.id, credentialId), eq(candidateCredentials.candidateAccountId, candidateAccountId)))
    .returning({ id: candidateCredentials.id });
  return record ?? null;
}

export async function deleteCandidateCredentialRecord(candidateAccountId: string, credentialId: string) {
  return db.transaction(async (transaction) => {
    const [owned] = await transaction.select({ storageKey: candidateCredentialDocuments.storageKey })
      .from(candidateCredentials)
      .leftJoin(candidateCredentialDocuments, eq(candidateCredentialDocuments.credentialId, candidateCredentials.id))
      .where(and(eq(candidateCredentials.id, credentialId), eq(candidateCredentials.candidateAccountId, candidateAccountId)))
      .limit(1).for("update");
    if (!owned) return { deleted: false, storageKey: null };
    await transaction.delete(candidateCredentials).where(and(
      eq(candidateCredentials.id, credentialId),
      eq(candidateCredentials.candidateAccountId, candidateAccountId),
    ));
    return { deleted: true, storageKey: owned.storageKey };
  });
}

export async function getOwnedCredentialDocument(candidateAccountId: string, credentialId: string) {
  const [document] = await db.select({
    storageKey: candidateCredentialDocuments.storageKey,
    byteSize: candidateCredentialDocuments.byteSize,
  }).from(candidateCredentials)
    .innerJoin(candidateCredentialDocuments, eq(candidateCredentialDocuments.credentialId, candidateCredentials.id))
    .where(and(eq(candidateCredentials.id, credentialId), eq(candidateCredentials.candidateAccountId, candidateAccountId)))
    .limit(1);
  return document ?? null;
}

export async function replaceOwnedCredentialDocument(
  candidateAccountId: string,
  credentialId: string,
  next: { storageKey: string; byteSize: number },
) {
  return db.transaction(async (transaction) => {
    const [credential] = await transaction.select({ id: candidateCredentials.id })
      .from(candidateCredentials)
      .where(and(eq(candidateCredentials.id, credentialId), eq(candidateCredentials.candidateAccountId, candidateAccountId)))
      .limit(1).for("update");
    if (!credential) return { found: false, oldStorageKey: null } as const;
    const [old] = await transaction.select({ storageKey: candidateCredentialDocuments.storageKey })
      .from(candidateCredentialDocuments).where(eq(candidateCredentialDocuments.credentialId, credentialId)).limit(1);
    await transaction.insert(candidateCredentialDocuments).values({ credentialId, ...next })
      .onConflictDoUpdate({
        target: candidateCredentialDocuments.credentialId,
        set: { ...next, contentType: "image/webp", updatedAt: new Date() },
      });
    return { found: true, oldStorageKey: old?.storageKey ?? null } as const;
  });
}

export async function removeOwnedCredentialDocument(candidateAccountId: string, credentialId: string) {
  return db.transaction(async (transaction) => {
    const [credential] = await transaction.select({ id: candidateCredentials.id })
      .from(candidateCredentials)
      .where(and(eq(candidateCredentials.id, credentialId), eq(candidateCredentials.candidateAccountId, candidateAccountId)))
      .limit(1).for("update");
    if (!credential) return { found: false, storageKey: null } as const;
    const [removed] = await transaction.delete(candidateCredentialDocuments)
      .where(eq(candidateCredentialDocuments.credentialId, credentialId))
      .returning({ storageKey: candidateCredentialDocuments.storageKey });
    return { found: true, storageKey: removed?.storageKey ?? null } as const;
  });
}
