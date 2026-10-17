"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { APPLICATION_STATUSES } from "@/applications/status-policy";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { transitionEmployerApplicationStatus, updateEmployerApplicationNote } from "./mutations";
import { validateEmployerNote } from "./note-policy";

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

  const detailPath = `/employer/jobs/${parsed.data.jobId}/applications/${parsed.data.applicationId}`;
  let result: Awaited<ReturnType<typeof transitionEmployerApplicationStatus>>;
  try {
    result = await transitionEmployerApplicationStatus({
      companyId: company.id,
      ...parsed.data,
    });
  } catch {
    redirect(`${detailPath}?transition=error`);
  }
  if (result === "not-found") notFound();

  if (result === "invalid-transition" || result === "stale") {
    redirect(`${detailPath}?transition=${result === "stale" ? "stale" : "invalid"}`);
  }

  revalidatePath(`/employer/jobs/${parsed.data.jobId}/applications`);
  revalidatePath(detailPath);
  revalidatePath("/candidate/applications");
}

const employerNoteIdsSchema = z.object({
  jobId: z.uuid(),
  applicationId: z.uuid(),
}).strict();

export async function saveEmployerApplicationNote(formData: FormData): Promise<void> {
  const { company } = await getEmployerDashboardContext();
  const ids = employerNoteIdsSchema.safeParse({
    jobId: formData.get("jobId"),
    applicationId: formData.get("applicationId"),
  });
  if (!ids.success) notFound();

  const note = validateEmployerNote(formData.get("note"));
  const detailPath = `/employer/jobs/${ids.data.jobId}/applications/${ids.data.applicationId}`;
  if (!note.success) redirect(`${detailPath}?note=validation`);

  let result: "updated" | "not-found";
  try {
    result = await updateEmployerApplicationNote({
      companyId: company.id,
      ...ids.data,
      employerNote: note.data,
    });
  } catch {
    redirect(`${detailPath}?note=persistence`);
  }

  if (result === "not-found") notFound();
  revalidatePath(detailPath);
  redirect(`${detailPath}?note=saved`);
}
