import type { ApplicationStatus } from "@/applications/status-policy";
import type { JobStatus } from "@/jobs/policy";

export const APPLICATION_MESSAGE_MAX_LENGTH = 2_000;
export const APPLICATION_MESSAGE_MIN_LENGTH = 2;
export const APPLICATION_MESSAGES_PER_MINUTE = 5;
export const APPLICATION_MESSAGES_PER_DAY = 50;
export const APPLICATION_THREAD_MESSAGE_LIMIT = 500;

export const applicationMessageKinds = ["recruitment_message", "interview_invitation"] as const;
export type ApplicationMessageKind = (typeof applicationMessageKinds)[number];
export type ApplicationMessageRole = "employer" | "candidate";

export function normalizeApplicationMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\r\n?/g, "\n");
  if (normalized.length < APPLICATION_MESSAGE_MIN_LENGTH || normalized.length > APPLICATION_MESSAGE_MAX_LENGTH) return null;
  if (/\u0000/.test(normalized)) return null;
  return normalized;
}

export function canSendApplicationMessage(input: {
  applicationStatus: ApplicationStatus;
  jobStatus: JobStatus;
  senderRole: ApplicationMessageRole;
  kind: ApplicationMessageKind;
  hasEmployerMessage: boolean;
}) {
  if (input.jobStatus !== "published") return false;
  if (input.applicationStatus === "rejected" || input.applicationStatus === "hired") return false;
  if (input.senderRole === "candidate" && !input.hasEmployerMessage) return false;
  if (input.senderRole === "candidate" && input.kind !== "recruitment_message") return false;
  return true;
}

export function messageSenderLabel(role: ApplicationMessageRole) {
  return role === "employer" ? "کارفرما" : "کارجو";
}

export function messageKindLabel(kind: ApplicationMessageKind) {
  return kind === "interview_invitation" ? "دعوت به مصاحبه" : "پیام جذب";
}
