"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCandidate } from "@/candidate-auth/session";
import { db } from "@/db";
import { candidateJobPreferences } from "@/db/schema";
import { buildCandidatePreferencePersistence } from "./policy";
import {
  candidateJobPreferencesFromFormData,
  candidateJobPreferencesSchema,
} from "./validation";

export async function saveCandidateJobPreferences(formData: FormData) {
  const candidate = await requireCandidate();
  const parsed = candidateJobPreferencesSchema.safeParse(
    candidateJobPreferencesFromFormData(formData),
  );
  if (!parsed.success) redirect("/candidate/preferences?error=invalid");

  const values = buildCandidatePreferencePersistence(candidate.id, parsed.data);
  await db.insert(candidateJobPreferences).values(values).onConflictDoUpdate({
    target: candidateJobPreferences.candidateAccountId,
    set: {
      preferredLocations: values.preferredLocations,
      preferredWorkplaceTypes: values.preferredWorkplaceTypes,
      preferredEmploymentTypes: values.preferredEmploymentTypes,
      preferredSeniorityLevels: values.preferredSeniorityLevels,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/candidate");
  revalidatePath("/candidate/preferences");
  redirect("/candidate/preferences?saved=1");
}
