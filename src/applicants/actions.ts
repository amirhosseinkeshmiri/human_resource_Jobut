"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { APPLICATION_STATUSES } from "@/applications/status-policy";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { transitionEmployerApplicationStatus } from "./mutations";

const transitionSchema = z.object({
  jobId: z.uuid(),
  applicationId: z.uuid(),
  targetStatus: z.enum(APPLICATION_STATUSES),
}).strict();

export async function transitionApplicationStatus(formData: FormData): Promise<void> {
  const { company } = await getEmployerDashboardContext();
  const parsed = transitionSchema.safeParse({
    jobId: formData.get("jobId"),
    applicationId: formData.get("applicationId"),
    targetStatus: formData.get("targetStatus"),
  });
  if (!parsed.success) notFound();

  const result = await transitionEmployerApplicationStatus({
    companyId: company.id,
    ...parsed.data,
  });
  if (result === "not-found") notFound();

  const detailPath = `/employer/jobs/${parsed.data.jobId}/applications/${parsed.data.applicationId}`;
  if (result === "invalid-transition" || result === "stale") {
    redirect(`${detailPath}?transition=${result === "stale" ? "stale" : "invalid"}`);
  }

  revalidatePath(`/employer/jobs/${parsed.data.jobId}/applications`);
  revalidatePath(detailPath);
  revalidatePath("/candidate/applications");
}
