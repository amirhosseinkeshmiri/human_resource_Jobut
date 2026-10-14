import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobApplications, jobPosts } from "@/db/schema";
import type { ApplicationStatus } from "@/applications/status-policy";
import { resolveApplicationTransition } from "@/applications/status-policy";

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
  const [application] = await db
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
  const decision = resolveApplicationTransition(application.status, input.targetStatus);
  if (decision === "noop") return "noop";
  if (decision === "invalid") return "invalid-transition";

  const updated = await db
    .update(jobApplications)
    .set({ status: input.targetStatus })
    .where(and(
      eq(jobApplications.id, application.id),
      eq(jobApplications.jobPostId, input.jobId),
      eq(jobApplications.status, application.status),
    ))
    .returning({ id: jobApplications.id });

  return updated.length === 1 ? "updated" : "stale";
}
