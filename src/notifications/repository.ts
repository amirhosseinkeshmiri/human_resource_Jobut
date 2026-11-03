import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateApplicationStatusNotifications,
  companies,
  jobApplications,
  jobApplicationStatusHistory,
  jobPosts,
} from "@/db/schema";
import { CANDIDATE_NOTIFICATION_PAGE_SIZE } from "./application-status-policy";

export async function materializeApplicationStatusNotificationsForApplication(applicationId: string) {
  await db.execute(sql`
    insert into candidate_application_status_notifications
      (candidate_account_id, status_history_id, occurred_at)
    select a.candidate_account_id, h.id, h.changed_at
    from job_application_status_history h
    inner join job_applications a on a.id = h.job_application_id
    where a.id = ${applicationId} and h.to_status::text <> 'withdrawn'
    on conflict (status_history_id) do nothing
  `);
}

export async function materializeCandidateApplicationStatusNotifications(candidateAccountId: string) {
  await db.execute(sql`
    insert into candidate_application_status_notifications
      (candidate_account_id, status_history_id, occurred_at)
    select a.candidate_account_id, h.id, h.changed_at
    from job_application_status_history h
    inner join job_applications a on a.id = h.job_application_id
    where a.candidate_account_id = ${candidateAccountId} and h.to_status::text <> 'withdrawn'
    on conflict (status_history_id) do nothing
  `);
}

export async function getCandidateApplicationNotifications(candidateAccountId: string, requestedPage: number) {
  const [totalRows, unreadRows] = await Promise.all([
    db.select({ value: count() }).from(candidateApplicationStatusNotifications)
      .where(eq(candidateApplicationStatusNotifications.candidateAccountId, candidateAccountId)),
    db.select({ value: count() }).from(candidateApplicationStatusNotifications)
      .where(and(
        eq(candidateApplicationStatusNotifications.candidateAccountId, candidateAccountId),
        isNull(candidateApplicationStatusNotifications.readAt),
      )),
  ]);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CANDIDATE_NOTIFICATION_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const notifications = await db.select({
    id: candidateApplicationStatusNotifications.id,
    applicationId: jobApplications.id,
    jobTitle: jobPosts.title,
    companyName: companies.name,
    toStatus: jobApplicationStatusHistory.toStatus,
    occurredAt: candidateApplicationStatusNotifications.occurredAt,
    readAt: candidateApplicationStatusNotifications.readAt,
  }).from(candidateApplicationStatusNotifications)
    .innerJoin(jobApplicationStatusHistory, eq(candidateApplicationStatusNotifications.statusHistoryId, jobApplicationStatusHistory.id))
    .innerJoin(jobApplications, eq(jobApplicationStatusHistory.jobApplicationId, jobApplications.id))
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(eq(candidateApplicationStatusNotifications.candidateAccountId, candidateAccountId))
    .orderBy(desc(candidateApplicationStatusNotifications.occurredAt), desc(candidateApplicationStatusNotifications.id))
    .limit(CANDIDATE_NOTIFICATION_PAGE_SIZE)
    .offset((page - 1) * CANDIDATE_NOTIFICATION_PAGE_SIZE);
  return { notifications, total, unread: unreadRows[0]?.value ?? 0, page, pageCount };
}

export async function markCandidateApplicationNotificationRead(
  candidateAccountId: string,
  notificationId: string,
) {
  const updated = await db.update(candidateApplicationStatusNotifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(candidateApplicationStatusNotifications.id, notificationId),
      eq(candidateApplicationStatusNotifications.candidateAccountId, candidateAccountId),
      isNull(candidateApplicationStatusNotifications.readAt),
    ))
    .returning({ id: candidateApplicationStatusNotifications.id });
  if (updated.length === 1) return "updated" as const;
  const [owned] = await db.select({ id: candidateApplicationStatusNotifications.id })
    .from(candidateApplicationStatusNotifications)
    .where(and(
      eq(candidateApplicationStatusNotifications.id, notificationId),
      eq(candidateApplicationStatusNotifications.candidateAccountId, candidateAccountId),
    )).limit(1);
  return owned ? "already-read" as const : "not-found" as const;
}
