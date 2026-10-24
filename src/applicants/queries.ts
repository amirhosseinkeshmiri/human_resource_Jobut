import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { APPLICATION_STATUSES, type ApplicationStatusFilter } from "@/applications/status-policy";
import { db } from "@/db";
import {
  applicationResumeSnapshotEducations,
  applicationResumeSnapshotExperiences,
  applicationResumeSnapshotLanguages,
  applicationResumeSnapshots,
  jobApplications,
  jobApplicationStatusHistory,
  jobPosts,
} from "@/db/schema";
import {
  EMPLOYER_APPLICANTS_PAGE_SIZE,
  getApplicantPageCount,
  isRouteId,
} from "./policy";
import {
  EMPLOYER_PIPELINE_LIMIT,
  emptyPipelineStatusCounts,
  isPipelineTruncated,
  type PipelineApplication,
} from "./pipeline-policy";
import { APPLICATION_STATUS_HISTORY_LIMIT } from "@/applications/status-history-policy";

export async function getEmployerJobPipeline(companyId: string, jobId: string) {
  if (!isRouteId(jobId)) return null;

  const rows = await db.select({
    jobId: jobPosts.id,
    jobTitle: jobPosts.title,
    jobStatus: jobPosts.status,
    total: sql<number>`count(${jobApplications.id}) over ()`,
    receivedCount: sql<number>`count(${jobApplications.id}) filter (where ${jobApplications.status} = 'received') over ()`,
    reviewingCount: sql<number>`count(${jobApplications.id}) filter (where ${jobApplications.status} = 'reviewing') over ()`,
    interviewCount: sql<number>`count(${jobApplications.id}) filter (where ${jobApplications.status} = 'interview') over ()`,
    rejectedCount: sql<number>`count(${jobApplications.id}) filter (where ${jobApplications.status} = 'rejected') over ()`,
    hiredCount: sql<number>`count(${jobApplications.id}) filter (where ${jobApplications.status} = 'hired') over ()`,
    applicationId: jobApplications.id,
    snapshotApplicationId: applicationResumeSnapshots.jobApplicationId,
    firstName: applicationResumeSnapshots.firstName,
    lastName: applicationResumeSnapshots.lastName,
    professionalTitle: applicationResumeSnapshots.professionalTitle,
    city: applicationResumeSnapshots.city,
    skills: applicationResumeSnapshots.skills,
    status: jobApplications.status,
    createdAt: jobApplications.createdAt,
  }).from(jobPosts)
    .leftJoin(jobApplications, eq(jobApplications.jobPostId, jobPosts.id))
    .leftJoin(
      applicationResumeSnapshots,
      eq(jobApplications.id, applicationResumeSnapshots.jobApplicationId),
    )
    .where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId)))
    .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
    .limit(EMPLOYER_PIPELINE_LIMIT);

  const first = rows[0];
  if (!first) return null;

  const counts = emptyPipelineStatusCounts();
  counts.received = Number(first.receivedCount);
  counts.reviewing = Number(first.reviewingCount);
  counts.interview = Number(first.interviewCount);
  counts.rejected = Number(first.rejectedCount);
  counts.hired = Number(first.hiredCount);

  const applications: PipelineApplication[] = [];
  for (const row of rows) {
    if (
      row.applicationId !== null
      && row.status !== null
      && row.createdAt !== null
    ) {
      applications.push({
        applicationId: row.applicationId,
        snapshotAvailable: row.snapshotApplicationId !== null,
        firstName: row.firstName,
        lastName: row.lastName,
        professionalTitle: row.professionalTitle,
        city: row.city,
        skills: row.skills,
        status: row.status,
        createdAt: row.createdAt,
      });
    }
  }

  const total = Number(first.total);
  return {
    job: { id: first.jobId, title: first.jobTitle, status: first.jobStatus },
    applications,
    counts,
    total,
    truncated: isPipelineTruncated(total, applications.length),
  };
}

export async function getEmployerJobApplicants(
  companyId: string,
  jobId: string,
  requestedPage: number,
  statusFilter: ApplicationStatusFilter,
) {
  if (!isRouteId(jobId)) return null;
  const [job] = await db.select({ id: jobPosts.id, title: jobPosts.title, status: jobPosts.status })
    .from(jobPosts).where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId))).limit(1);
  if (!job) return null;

  const countRows = await db.select({ status: jobApplications.status, value: count() })
    .from(jobApplications)
    .where(eq(jobApplications.jobPostId, job.id))
    .groupBy(jobApplications.status);
  const statusCounts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<(typeof APPLICATION_STATUSES)[number], number>;
  for (const row of countRows) statusCounts[row.status] = row.value;
  const allCount = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const total = statusFilter === "all" ? allCount : statusCounts[statusFilter];
  const pageCount = getApplicantPageCount(total);
  const page = Math.min(requestedPage, pageCount);
  const listCondition = statusFilter === "all"
    ? eq(jobApplications.jobPostId, job.id)
    : and(eq(jobApplications.jobPostId, job.id), eq(jobApplications.status, statusFilter));
  const applications = await db.select({
    applicationId: jobApplications.id,
    snapshotAvailable: sql<boolean>`${applicationResumeSnapshots.jobApplicationId} is not null`,
    firstName: applicationResumeSnapshots.firstName,
    lastName: applicationResumeSnapshots.lastName,
    professionalTitle: applicationResumeSnapshots.professionalTitle,
    city: applicationResumeSnapshots.city,
    skills: applicationResumeSnapshots.skills,
    status: jobApplications.status,
    createdAt: jobApplications.createdAt,
  }).from(jobApplications)
    .leftJoin(
      applicationResumeSnapshots,
      eq(jobApplications.id, applicationResumeSnapshots.jobApplicationId),
    )
    .where(listCondition)
    .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
    .limit(EMPLOYER_APPLICANTS_PAGE_SIZE)
    .offset((page - 1) * EMPLOYER_APPLICANTS_PAGE_SIZE);

  return { job, applications, total, allCount, statusCounts, statusFilter, page, pageCount };
}

export async function getEmployerApplicantResume(companyId: string, jobId: string, applicationId: string) {
  if (!isRouteId(jobId) || !isRouteId(applicationId)) return null;
  const [result] = await db.select({
    applicationId: jobApplications.id,
    applicationStatus: jobApplications.status,
    employerNote: jobApplications.employerNote,
    applicationCreatedAt: jobApplications.createdAt,
    jobId: jobPosts.id,
    jobTitle: jobPosts.title,
    jobStatus: jobPosts.status,
    snapshotApplicationId: applicationResumeSnapshots.jobApplicationId,
    snapshotCapturedAt: applicationResumeSnapshots.capturedAt,
    firstName: applicationResumeSnapshots.firstName,
    lastName: applicationResumeSnapshots.lastName,
    city: applicationResumeSnapshots.city,
    professionalTitle: applicationResumeSnapshots.professionalTitle,
    professionalSummary: applicationResumeSnapshots.professionalSummary,
    skills: applicationResumeSnapshots.skills,
    linkedinUrl: applicationResumeSnapshots.linkedinUrl,
    portfolioUrl: applicationResumeSnapshots.portfolioUrl,
  }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .leftJoin(
      applicationResumeSnapshots,
      eq(jobApplications.id, applicationResumeSnapshots.jobApplicationId),
    )
    .where(and(
      eq(jobApplications.id, applicationId),
      eq(jobApplications.jobPostId, jobId),
      eq(jobPosts.companyId, companyId),
    )).limit(1);
  if (!result) return null;

  const [experiences, educations, languages, statusHistory] = await Promise.all([
    db.select({ jobTitle: applicationResumeSnapshotExperiences.jobTitle, companyName: applicationResumeSnapshotExperiences.companyName, startDate: applicationResumeSnapshotExperiences.startDate, endDate: applicationResumeSnapshotExperiences.endDate, isCurrent: applicationResumeSnapshotExperiences.isCurrent, description: applicationResumeSnapshotExperiences.description })
      .from(applicationResumeSnapshotExperiences).where(eq(applicationResumeSnapshotExperiences.jobApplicationId, result.applicationId)).orderBy(asc(applicationResumeSnapshotExperiences.sortOrder)),
    db.select({ fieldOfStudy: applicationResumeSnapshotEducations.fieldOfStudy, institutionName: applicationResumeSnapshotEducations.institutionName, degree: applicationResumeSnapshotEducations.degree, startDate: applicationResumeSnapshotEducations.startDate, endDate: applicationResumeSnapshotEducations.endDate, isCurrent: applicationResumeSnapshotEducations.isCurrent })
      .from(applicationResumeSnapshotEducations).where(eq(applicationResumeSnapshotEducations.jobApplicationId, result.applicationId)).orderBy(asc(applicationResumeSnapshotEducations.sortOrder)),
    db.select({ name: applicationResumeSnapshotLanguages.name, proficiency: applicationResumeSnapshotLanguages.proficiency })
      .from(applicationResumeSnapshotLanguages).where(eq(applicationResumeSnapshotLanguages.jobApplicationId, result.applicationId)).orderBy(asc(applicationResumeSnapshotLanguages.sortOrder)),
    db.select({
      id: jobApplicationStatusHistory.id,
      fromStatus: jobApplicationStatusHistory.fromStatus,
      toStatus: jobApplicationStatusHistory.toStatus,
      changedAt: jobApplicationStatusHistory.changedAt,
    }).from(jobApplicationStatusHistory)
      .where(eq(jobApplicationStatusHistory.jobApplicationId, result.applicationId))
      .orderBy(asc(jobApplicationStatusHistory.changedAt), asc(jobApplicationStatusHistory.id))
      .limit(APPLICATION_STATUS_HISTORY_LIMIT),
  ]);

  return {
    ...result,
    snapshotAvailable: result.snapshotApplicationId !== null,
    experiences,
    educations,
    languages,
    statusHistory,
  };
}

export async function getJobApplicationCount(companyId: string, jobId: string) {
  const [result] = await db.select({ value: count() }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId)));
  return result.value;
}

export async function getCompanyApplicationCount(companyId: string) {
  const [result] = await db.select({ value: count() }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .where(eq(jobPosts.companyId, companyId));
  return result.value;
}
