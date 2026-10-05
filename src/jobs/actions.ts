"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { db } from "@/db";
import { jobPosts } from "@/db/schema";
import { createDraftJobValues, validateJobTitle } from "./policy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createDraftJob(formData: FormData) {
  const { company } = await getEmployerDashboardContext();
  const titleResult = validateJobTitle(formData.get("title"));
  if (!titleResult.ok) redirect("/employer/jobs/new?error=title");

  let createdJobId: string | undefined;
  try {
    const [createdJob] = await db.insert(jobPosts)
      .values(createDraftJobValues(company.id, titleResult.title))
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
  const titleResult = validateJobTitle(formData.get("title"));
  if (!titleResult.ok) redirect(`/employer/jobs/${jobId}?error=title`);

  let wasUpdated = false;
  try {
    const [updatedJob] = await db.update(jobPosts)
      .set({ title: titleResult.title, updatedAt: new Date() })
      .where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, company.id), eq(jobPosts.status, "draft")))
      .returning({ id: jobPosts.id });
    wasUpdated = Boolean(updatedJob);
  } catch {
    redirect(`/employer/jobs/${jobId}?error=persistence`);
  }
  if (!wasUpdated) redirect("/employer/jobs");
  redirect(`/employer/jobs/${jobId}?updated=1`);
}
