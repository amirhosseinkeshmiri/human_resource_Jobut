"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCandidate } from "@/candidate-auth/session";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { isBoundedAuthFormData } from "@/auth/form-security";
import { isCandidateApplicationNotificationsEnabled } from "./feature";
import { markCandidateApplicationNotificationRead } from "./repository";

const notificationIdSchema = z.uuid();

export async function markApplicationNotificationRead(formData: FormData) {
  const candidate = await requireCandidate();
  if (!isCandidateApplicationNotificationsEnabled()) redirect("/candidate/notifications?result=unavailable");
  const inspection = await inspectTrustedAuthActionRequest();
  const parsed = notificationIdSchema.safeParse(formData.get("notificationId"));
  if (!inspection.trusted || !isBoundedAuthFormData(formData, ["notificationId"]) || !parsed.success) {
    redirect("/candidate/notifications?result=invalid");
  }
  const result = await markCandidateApplicationNotificationRead(candidate.id, parsed.data);
  if (result === "not-found") redirect("/candidate/notifications?result=not-found");
  revalidatePath("/candidate/notifications");
  revalidatePath("/candidate");
}
