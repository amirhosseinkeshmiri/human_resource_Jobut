import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateJobPreferences } from "@/db/schema";
import type { CandidateJobPreferences } from "./validation";

export const emptyCandidateJobPreferences: CandidateJobPreferences = {
  preferredLocations: [],
  preferredWorkplaceTypes: [],
  preferredEmploymentTypes: [],
  preferredSeniorityLevels: [],
};

export async function getCandidateJobPreferences(candidateAccountId: string) {
  const [preferences] = await db.select({
    preferredLocations: candidateJobPreferences.preferredLocations,
    preferredWorkplaceTypes: candidateJobPreferences.preferredWorkplaceTypes,
    preferredEmploymentTypes: candidateJobPreferences.preferredEmploymentTypes,
    preferredSeniorityLevels: candidateJobPreferences.preferredSeniorityLevels,
    updatedAt: candidateJobPreferences.updatedAt,
  }).from(candidateJobPreferences)
    .where(eq(candidateJobPreferences.candidateAccountId, candidateAccountId))
    .limit(1);

  if (!preferences) return { values: emptyCandidateJobPreferences, updatedAt: null };
  const { updatedAt, ...values } = preferences;
  return { values, updatedAt };
}
