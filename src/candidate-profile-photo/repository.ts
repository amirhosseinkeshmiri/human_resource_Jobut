import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateAccounts, candidateProfilePhotos } from "@/db/schema";

export async function getCandidateProfilePhoto(candidateAccountId: string) {
  const [photo] = await db
    .select({
      storageKey: candidateProfilePhotos.storageKey,
      contentType: candidateProfilePhotos.contentType,
      byteSize: candidateProfilePhotos.byteSize,
      updatedAt: candidateProfilePhotos.updatedAt,
    })
    .from(candidateProfilePhotos)
    .where(eq(candidateProfilePhotos.candidateAccountId, candidateAccountId))
    .limit(1);
  return photo ?? null;
}

export async function replaceCandidateProfilePhoto(
  candidateAccountId: string,
  next: { storageKey: string; byteSize: number },
) {
  return db.transaction(async (transaction) => {
    // Lock the account row so concurrent replacements for one Candidate serialize.
    await transaction
      .select({ id: candidateAccounts.id })
      .from(candidateAccounts)
      .where(eq(candidateAccounts.id, candidateAccountId))
      .limit(1)
      .for("update");
    const [existing] = await transaction
      .select({ storageKey: candidateProfilePhotos.storageKey })
      .from(candidateProfilePhotos)
      .where(eq(candidateProfilePhotos.candidateAccountId, candidateAccountId))
      .limit(1);
    await transaction
      .insert(candidateProfilePhotos)
      .values({ candidateAccountId, storageKey: next.storageKey, byteSize: next.byteSize })
      .onConflictDoUpdate({
        target: candidateProfilePhotos.candidateAccountId,
        set: { storageKey: next.storageKey, byteSize: next.byteSize, contentType: "image/webp", updatedAt: new Date() },
      });
    return existing?.storageKey ?? null;
  });
}

export async function removeCandidateProfilePhoto(candidateAccountId: string) {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: candidateAccounts.id })
      .from(candidateAccounts)
      .where(eq(candidateAccounts.id, candidateAccountId))
      .limit(1)
      .for("update");
    const [deleted] = await transaction
      .delete(candidateProfilePhotos)
      .where(eq(candidateProfilePhotos.candidateAccountId, candidateAccountId))
      .returning({ storageKey: candidateProfilePhotos.storageKey });
    return deleted?.storageKey ?? null;
  });
}
