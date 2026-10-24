"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireCandidate } from "@/candidate-auth/session";
import { getEmployerDashboardContext } from "@/dashboard/context";
import { markApplicationMessagesRead, sendApplicationMessage } from "./domain";
import { applicationMessageKinds, normalizeApplicationMessage } from "./policy";

const employerMessageSchema = z.object({ jobId: z.uuid(), applicationId: z.uuid(), idempotencyKey: z.uuid(), kind: z.enum(applicationMessageKinds) }).strict();
const candidateMessageSchema = z.object({ applicationId: z.uuid(), idempotencyKey: z.uuid() }).strict();

function outcomeQuery(result: Awaited<ReturnType<typeof sendApplicationMessage>>) {
  if (result === "sent" || result === "replayed") return "sent";
  if (result === "rate-limited") return "rate";
  if (result === "duplicate") return "duplicate";
  if (result === "invalid") return "validation";
  return "unavailable";
}

export async function sendEmployerApplicationMessage(formData: FormData): Promise<void> {
  const { employer, company } = await getEmployerDashboardContext();
  const ids = employerMessageSchema.safeParse({ jobId: formData.get("jobId"), applicationId: formData.get("applicationId"), idempotencyKey: formData.get("idempotencyKey"), kind: formData.get("kind") });
  if (!ids.success) notFound();
  const path = `/employer/jobs/${ids.data.jobId}/applications/${ids.data.applicationId}`;
  const body = normalizeApplicationMessage(formData.get("body"));
  if (!body) redirect(`${path}?message=validation#messages`);
  let result: Awaited<ReturnType<typeof sendApplicationMessage>>;
  try {
    result = await sendApplicationMessage({ role: "employer", employerAccountId: employer.id, companyId: company.id, applicationId: ids.data.applicationId, idempotencyKey: ids.data.idempotencyKey, kind: ids.data.kind, body });
  } catch {
    redirect(`${path}?message=error#messages`);
  }
  if (result === "not-found") notFound();
  revalidatePath(path);
  revalidatePath(`/candidate/applications/${ids.data.applicationId}`);
  redirect(`${path}?message=${outcomeQuery(result)}#messages`);
}

export async function sendCandidateApplicationMessage(formData: FormData): Promise<void> {
  const candidate = await requireCandidate();
  const ids = candidateMessageSchema.safeParse({ applicationId: formData.get("applicationId"), idempotencyKey: formData.get("idempotencyKey") });
  if (!ids.success) notFound();
  const path = `/candidate/applications/${ids.data.applicationId}`;
  const body = normalizeApplicationMessage(formData.get("body"));
  if (!body) redirect(`${path}?message=validation#messages`);
  let result: Awaited<ReturnType<typeof sendApplicationMessage>>;
  try {
    result = await sendApplicationMessage({ role: "candidate", candidateAccountId: candidate.id, applicationId: ids.data.applicationId, idempotencyKey: ids.data.idempotencyKey, kind: "recruitment_message", body });
  } catch {
    redirect(`${path}?message=error#messages`);
  }
  if (result === "not-found") notFound();
  revalidatePath(path);
  redirect(`${path}?message=${outcomeQuery(result)}#messages`);
}

export async function markEmployerMessagesRead(formData: FormData): Promise<void> {
  const { employer, company } = await getEmployerDashboardContext();
  const ids = employerMessageSchema.pick({ jobId: true, applicationId: true }).safeParse({ jobId: formData.get("jobId"), applicationId: formData.get("applicationId") });
  if (!ids.success) notFound();
  const result = await markApplicationMessagesRead({ applicationId: ids.data.applicationId, readerRole: "employer", employerAccountId: employer.id, companyId: company.id });
  if (result === "not-found") notFound();
  revalidatePath(`/employer/jobs/${ids.data.jobId}/applications/${ids.data.applicationId}`);
}

export async function markCandidateMessagesRead(formData: FormData): Promise<void> {
  const candidate = await requireCandidate();
  const ids = candidateMessageSchema.pick({ applicationId: true }).safeParse({ applicationId: formData.get("applicationId") });
  if (!ids.success) notFound();
  const result = await markApplicationMessagesRead({ applicationId: ids.data.applicationId, readerRole: "candidate", candidateAccountId: candidate.id });
  if (result === "not-found") notFound();
  revalidatePath(`/candidate/applications/${ids.data.applicationId}`);
}
