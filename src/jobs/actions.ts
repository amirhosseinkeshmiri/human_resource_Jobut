"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { db } from "@/db";
import { jobPosts } from "@/db/schema";
import { createDraftJobValues } from "./policy";
import { PublishJobError, publishJobPost } from "./publish";
import { sanitizeJobDescription } from "./description";
import { jobPostFormSchema, jobPostValuesFromFormData } from "./validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createDraftJob(formData: FormData) {
  const { company } = await getEmployerDashboardContext();
  const rawValues = jobPostValuesFromFormData(formData);
  const result = jobPostFormSchema.safeParse({
    ...rawValues,
    description: sanitizeJobDescription(rawValues.description),
  });
  if (!result.success) redirect("/employer/jobs/new?error=validation");

  let createdJobId: string | undefined;
  try {
    const [createdJob] = await db.insert(jobPosts)
      .values(createDraftJobValues(company.id, result.data))
      .returning({ id: jobPosts.id });
    createdJobId = createdJob?.id;
  } catch {
    redirect("/employer/jobs/new?error=persistence");
  }
  if (!createdJobId) redirect("/employer/jobs/new?error=persistence");
  redirect(`/employer/jobs/${createdJobId}?created=1`);
}

export async function updateDraftJob(jobId: string, formData: FormData) {
  const { company } = await getEmployerDashboardContext();
  if (!UUID_PATTERN.test(jobId)) redirect("/employer/jobs");
  const rawValues = jobPostValuesFromFormData(formData);
  const result = jobPostFormSchema.safeParse({
    ...rawValues,
    description: sanitizeJobDescription(rawValues.description),
  });
  if (!result.success) redirect(`/employer/jobs/${jobId}?error=validation`);

  let wasUpdated = false;
  try {
    const [updatedJob] = await db.update(jobPosts)
      .set({ ...result.data, updatedAt: new Date() })
      .where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, company.id), eq(jobPosts.status, "draft")))
      .returning({ id: jobPosts.id });
    wasUpdated = Boolean(updatedJob);
  } catch {
    redirect(`/employer/jobs/${jobId}?error=persistence`);
  }
  if (!wasUpdated) redirect("/employer/jobs");
  redirect(`/employer/jobs/${jobId}?updated=1`);
}

export async function publishDraftJob(jobId: string) {
  const { company } = await getEmployerDashboardContext();
  if (!UUID_PATTERN.test(jobId)) redirect("/employer/jobs");

  let outcome: "published" | "not-found" | "not-draft" | "incomplete" | "insufficient" | "error" = "error";

  try {
    await publishJobPost(company.id, jobId);
    outcome = "published";
  } catch (error) {
    if (error instanceof PublishJobError) {
      outcome = error.code === "insufficient-credit"
        ? "insufficient"
        : error.code === "incomplete"
          ? "incomplete"
        : error.code === "not-draft"
          ? "not-draft"
          : error.code === "not-found"
            ? "not-found"
            : "error";
    }
  }

  if (outcome === "not-found") redirect("/employer/jobs");
  if (outcome !== "published") redirect(`/employer/jobs/${jobId}?publish=${outcome}`);

  revalidatePath("/employer");
  revalidatePath("/employer/jobs");
  revalidatePath(`/employer/jobs/${jobId}`);
  revalidatePath("/employer/packages");
  redirect(`/employer/jobs/${jobId}?published=1`);
}
