"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isBoundedAuthFormData } from "@/auth/form-security";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { requireCandidate } from "@/candidate-auth/session";
import { db } from "@/db";
import { candidateSavedJobs, jobPosts } from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import { canMutateSavedJob, isCandidateSavedJobsEnabled, SAVED_JOBS_BROWSER_FIELDS } from "./policy";

const jobIdSchema = z.uuid();
export interface SavedJobActionState {
  status: "idle" | "success" | "error";
  saved: boolean;
  message?: string;
}

export async function setCandidateJobSaved(
  previousState: SavedJobActionState,
  formData: FormData,
): Promise<SavedJobActionState> {
  const candidate = await requireCandidate();
  const featureEnabled = isCandidateSavedJobsEnabled();
  const jobId = jobIdSchema.safeParse(formData.get("jobPostId"));
  const desiredValue = formData.get("saved");
  const desiredStateValid = desiredValue === "true" || desiredValue === "false";
  const requestInspection = await inspectTrustedAuthActionRequest();
  if (!canMutateSavedJob({
    featureEnabled,
    authenticatedCandidate: true,
    originTrusted: requestInspection.trusted,
    formBounded: isBoundedAuthFormData(formData, [...SAVED_JOBS_BROWSER_FIELDS]),
    jobIdValid: jobId.success,
    desiredStateValid,
  }) || !jobId.success || !desiredStateValid) {
    return { status: "error", saved: previousState.saved, message: featureEnabled ? "درخواست ذخیره آگهی معتبر نیست." : "قابلیت ذخیره آگهی هنوز فعال نشده است." };
  }

  const shouldSave = desiredValue === "true";
  try {
    if (shouldSave) {
      const available = await db.transaction(async (transaction) => {
        const [job] = await transaction.select({ id: jobPosts.id })
          .from(jobPosts)
          .where(and(eq(jobPosts.id, jobId.data), publicJobConditions(new Date())))
          .limit(1)
          .for("share");
        if (!job) return false;
        await transaction.insert(candidateSavedJobs).values({
          candidateAccountId: candidate.id,
          jobPostId: jobId.data,
        }).onConflictDoNothing({
          target: [candidateSavedJobs.candidateAccountId, candidateSavedJobs.jobPostId],
        });
        return true;
      });
      if (!available) return { status: "error", saved: false, message: "این فرصت شغلی دیگر برای ذخیره در دسترس نیست." };
    } else {
      await db.delete(candidateSavedJobs).where(and(
        eq(candidateSavedJobs.candidateAccountId, candidate.id),
        eq(candidateSavedJobs.jobPostId, jobId.data),
      ));
    }
  } catch {
    console.error(JSON.stringify({ event: "candidate_saved_job_failure", operation: shouldSave ? "save" : "remove", code: "database_error" }));
    return { status: "error", saved: previousState.saved, message: "تغییر وضعیت آگهی انجام نشد؛ دوباره تلاش کنید." };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId.data}`);
  revalidatePath("/candidate/saved-jobs");
  return { status: "success", saved: shouldSave, message: shouldSave ? "آگهی ذخیره شد." : "آگهی از ذخیره‌شده‌ها حذف شد." };
}
