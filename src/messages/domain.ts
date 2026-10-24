import "server-only";

import { and, asc, count, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applicationMessageEvents,
  applicationMessages,
  companies,
  jobApplications,
  jobPosts,
} from "@/db/schema";
import {
  APPLICATION_MESSAGES_PER_DAY,
  APPLICATION_MESSAGES_PER_MINUTE,
  APPLICATION_THREAD_MESSAGE_LIMIT,
  canSendApplicationMessage,
  normalizeApplicationMessage,
  type ApplicationMessageKind,
  type ApplicationMessageRole,
} from "./policy";

export type SendMessageResult = "sent" | "replayed" | "not-found" | "unavailable" | "rate-limited" | "duplicate" | "invalid";

type Sender =
  | { role: "employer"; employerAccountId: string; companyId: string; candidateAccountId?: never }
  | { role: "candidate"; candidateAccountId: string; employerAccountId?: never; companyId?: never };

function senderCondition(sender: Sender) {
  return sender.role === "employer"
    ? and(eq(applicationMessages.senderRole, "employer"), eq(applicationMessages.senderEmployerAccountId, sender.employerAccountId))
    : and(eq(applicationMessages.senderRole, "candidate"), eq(applicationMessages.senderCandidateAccountId, sender.candidateAccountId));
}

export async function sendApplicationMessage(input: {
  applicationId: string;
  idempotencyKey: string;
  body: string;
  kind: ApplicationMessageKind;
  now?: Date;
} & Sender): Promise<SendMessageResult> {
  const now = input.now ?? new Date();
  const body = normalizeApplicationMessage(input.body);
  if (!body) return "invalid";
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`application-messages:${input.applicationId}`}, 0))`);

    const ownership = input.role === "employer"
      ? and(
        eq(jobApplications.id, input.applicationId),
        eq(jobPosts.companyId, input.companyId),
        eq(companies.employerAccountId, input.employerAccountId),
      )
      : and(eq(jobApplications.id, input.applicationId), eq(jobApplications.candidateAccountId, input.candidateAccountId));
    const [application] = await tx.select({
      id: jobApplications.id,
      applicationStatus: jobApplications.status,
      jobStatus: jobPosts.status,
    }).from(jobApplications)
      .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
      .innerJoin(companies, eq(jobPosts.companyId, companies.id))
      .where(ownership)
      .limit(1);
    if (!application) return "not-found";

    const [existing] = await tx.select({ id: applicationMessages.id }).from(applicationMessages).where(and(
      eq(applicationMessages.jobApplicationId, application.id),
      eq(applicationMessages.senderRole, input.role),
      eq(applicationMessages.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existing) return "replayed";

    const [{ value: employerMessageCount }] = await tx.select({ value: count() }).from(applicationMessages).where(and(
      eq(applicationMessages.jobApplicationId, application.id),
      eq(applicationMessages.senderRole, "employer"),
    ));
    if (!canSendApplicationMessage({
      applicationStatus: application.applicationStatus,
      jobStatus: application.jobStatus,
      senderRole: input.role,
      kind: input.kind,
      hasEmployerMessage: Number(employerMessageCount) > 0,
    })) return "unavailable";

    const minuteAgo = new Date(now.getTime() - 60_000);
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const senderScope = senderCondition(input);
    const [minuteCount, dayCount, threadCount, duplicate] = await Promise.all([
      tx.select({ value: count() }).from(applicationMessages).where(and(eq(applicationMessages.jobApplicationId, application.id), senderScope, gt(applicationMessages.createdAt, minuteAgo))),
      tx.select({ value: count() }).from(applicationMessages).where(and(eq(applicationMessages.jobApplicationId, application.id), senderScope, gt(applicationMessages.createdAt, dayAgo))),
      tx.select({ value: count() }).from(applicationMessages).where(eq(applicationMessages.jobApplicationId, application.id)),
      tx.select({ id: applicationMessages.id }).from(applicationMessages).where(and(eq(applicationMessages.jobApplicationId, application.id), senderScope, eq(applicationMessages.body, body), gt(applicationMessages.createdAt, minuteAgo))).limit(1),
    ]);
    if (Number(minuteCount[0].value) >= APPLICATION_MESSAGES_PER_MINUTE || Number(dayCount[0].value) >= APPLICATION_MESSAGES_PER_DAY || Number(threadCount[0].value) >= APPLICATION_THREAD_MESSAGE_LIMIT) return "rate-limited";
    if (duplicate.length) return "duplicate";

    const [message] = await tx.insert(applicationMessages).values({
      jobApplicationId: application.id,
      senderRole: input.role,
      senderEmployerAccountId: input.role === "employer" ? input.employerAccountId : null,
      senderCandidateAccountId: input.role === "candidate" ? input.candidateAccountId : null,
      kind: input.kind,
      body,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
    }).onConflictDoNothing().returning({ id: applicationMessages.id });
    if (!message) return "replayed";
    await tx.insert(applicationMessageEvents).values({ applicationMessageId: message.id, eventType: "sent", actorRole: input.role, occurredAt: now });
    return "sent";
  });
}

export async function getApplicationMessagesForEmployer(input: { employerAccountId: string; companyId: string; applicationId: string }) {
  const [owned] = await db.select({ id: jobApplications.id, status: jobApplications.status, jobStatus: jobPosts.status }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(and(eq(jobApplications.id, input.applicationId), eq(jobPosts.companyId, input.companyId), eq(companies.employerAccountId, input.employerAccountId))).limit(1);
  if (!owned) return null;
  const messages = await db.select({ id: applicationMessages.id, senderRole: applicationMessages.senderRole, kind: applicationMessages.kind, body: applicationMessages.body, createdAt: applicationMessages.createdAt, readAt: applicationMessages.readAt }).from(applicationMessages).where(eq(applicationMessages.jobApplicationId, owned.id)).orderBy(asc(applicationMessages.createdAt), asc(applicationMessages.id));
  return { ...owned, messages };
}

export async function getApplicationMessagesForCandidate(input: { candidateAccountId: string; applicationId: string }) {
  const [owned] = await db.select({ id: jobApplications.id, status: jobApplications.status, jobStatus: jobPosts.status }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .where(and(eq(jobApplications.id, input.applicationId), eq(jobApplications.candidateAccountId, input.candidateAccountId))).limit(1);
  if (!owned) return null;
  const messages = await db.select({ id: applicationMessages.id, senderRole: applicationMessages.senderRole, kind: applicationMessages.kind, body: applicationMessages.body, createdAt: applicationMessages.createdAt, readAt: applicationMessages.readAt }).from(applicationMessages).where(eq(applicationMessages.jobApplicationId, owned.id)).orderBy(asc(applicationMessages.createdAt), asc(applicationMessages.id));
  return { ...owned, messages };
}

export async function markApplicationMessagesRead(input: { applicationId: string; readerRole: ApplicationMessageRole; employerAccountId?: string; companyId?: string; candidateAccountId?: string; now?: Date }) {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const ownership = input.readerRole === "employer"
      ? and(eq(jobApplications.id, input.applicationId), eq(jobPosts.companyId, input.companyId!), eq(companies.employerAccountId, input.employerAccountId!))
      : and(eq(jobApplications.id, input.applicationId), eq(jobApplications.candidateAccountId, input.candidateAccountId!));
    const [owned] = await tx.select({ id: jobApplications.id }).from(jobApplications).innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id)).innerJoin(companies, eq(jobPosts.companyId, companies.id)).where(ownership).limit(1);
    if (!owned) return "not-found" as const;
    const updated = await tx.update(applicationMessages).set({ readAt: now }).where(and(eq(applicationMessages.jobApplicationId, owned.id), ne(applicationMessages.senderRole, input.readerRole), sql`${applicationMessages.readAt} is null`)).returning({ id: applicationMessages.id });
    if (updated.length) await tx.insert(applicationMessageEvents).values(updated.map((message) => ({ applicationMessageId: message.id, eventType: "read" as const, actorRole: input.readerRole, occurredAt: now })));
    return "updated" as const;
  });
}
