import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobApplications, jobApplicationStatusHistory, jobPosts } from "@/db/schema";
import type { ApplicationStatus } from "@/applications/status-policy";
import {
  buildApplicationStatusHistoryInsert,
  planApplicationStatusTransition,
  shouldAppendApplicationStatusHistory,
} from "@/applications/status-history-policy";
import { buildEmployerNoteUpdate } from "./note-policy";

export type ApplicationTransitionResult =
  | "updated"
  | "noop"
  | "not-found"
  | "invalid-transition"
  | "stale";

export async function transitionEmployerApplicationStatus(input: {
  companyId: string;
  jobId: string;
  applicationId: string;
  targetStatus: ApplicationStatus;
}): Promise<ApplicationTransitionResult> {
  return db.transaction(async (transaction) => {
    const [application] = await transaction
      .select({ id: jobApplications.id, status: jobApplications.status })
      .from(jobApplications)
      .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
      .where(and(
        eq(jobApplications.id, input.applicationId),
        eq(jobApplications.jobPostId, input.jobId),
        eq(jobPosts.companyId, input.companyId),
      ))
      .limit(1);

    if (!application) return "not-found";
    const plan = planApplicationStatusTransition(application.status, input.targetStatus);
    if (plan.decision === "noop") return "noop";
    if (plan.decision !== "update") return "invalid-transition";

    const updated = await transaction
      .update(jobApplications)
      .set({ status: input.targetStatus })
      .where(and(
        eq(jobApplications.id, application.id),
        eq(jobApplications.jobPostId, input.jobId),
        eq(jobApplications.status, application.status),
      ))
      .returning({ id: jobApplications.id });

    if (!shouldAppendApplicationStatusHistory(plan.decision, updated.length === 1)) return "stale";

    await transaction.insert(jobApplicationStatusHistory).values(
      buildApplicationStatusHistoryInsert(
        application.id,
        plan.history.fromStatus,
        plan.history.toStatus,
      ),
    );
    return "updated";
  });
}

export async function updateEmployerApplicationNote(input: {
  companyId: string;
  jobId: string;
  applicationId: string;
  employerNote: string | null;
}) {
  const [ownedApplication] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .where(and(
      eq(jobApplications.id, input.applicationId),
      eq(jobApplications.jobPostId, input.jobId),
      eq(jobPosts.companyId, input.companyId),
    ))
    .limit(1);

  if (!ownedApplication) return "not-found" as const;

  const updated = await db
    .update(jobApplications)
    .set(buildEmployerNoteUpdate(input.employerNote))
    .where(and(
      eq(jobApplications.id, ownedApplication.id),
      eq(jobApplications.jobPostId, input.jobId),
    ))
    .returning({ id: jobApplications.id });

  return updated.length === 1 ? "updated" as const : "not-found" as const;
}
