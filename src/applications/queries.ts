import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applicationResumeSnapshotEducations,
  applicationResumeSnapshotExperiences,
  applicationResumeSnapshotLanguages,
  applicationResumeSnapshots,
  companies,
  jobApplications,
  jobPosts,
} from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import { getCandidateResume } from "@/resume/queries";
import { isStoredResumeComplete } from "@/resume/policy";

export async function getCandidateApplyState(candidateAccountId: string, jobPostId: string) {
  const [resume, existing] = await Promise.all([
    getCandidateResume(candidateAccountId),
    db.select({ id: jobApplications.id }).from(jobApplications).where(and(
      eq(jobApplications.candidateAccountId, candidateAccountId),
      eq(jobApplications.jobPostId, jobPostId),
    )).limit(1),
  ]);
  return {
    resumeComplete: resume ? isStoredResumeComplete(resume) : false,
    alreadyApplied: Boolean(existing[0]),
  };
}

export async function getCandidateApplications(candidateAccountId: string, now = new Date()) {
  const rows = await db.select({
    id: jobApplications.id,
    createdAt: jobApplications.createdAt,
    applicationStatus: jobApplications.status,
    jobPostId: jobPosts.id,
    jobTitle: jobPosts.title,
    jobLocation: jobPosts.location,
    companyName: companies.name,
    jobStatus: jobPosts.status,
    publishedAt: jobPosts.publishedAt,
    expiresAt: jobPosts.expiresAt,
    snapshotAvailable: sql<boolean>`${applicationResumeSnapshots.jobApplicationId} is not null`,
    isPublic: publicJobConditions(now).mapWith(Boolean),
  }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .leftJoin(applicationResumeSnapshots, eq(jobApplications.id, applicationResumeSnapshots.jobApplicationId))
    .where(eq(jobApplications.candidateAccountId, candidateAccountId))
    .orderBy(desc(jobApplications.createdAt))
    .limit(50);

  return rows;
}

export async function getCandidateApplicationResumeSnapshot(
  candidateAccountId: string,
  applicationId: string,
) {
  const [application] = await db.select({
    applicationId: jobApplications.id,
    applicationCreatedAt: jobApplications.createdAt,
    jobTitle: jobPosts.title,
    companyName: companies.name,
    snapshotApplicationId: applicationResumeSnapshots.jobApplicationId,
    capturedAt: applicationResumeSnapshots.capturedAt,
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
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .leftJoin(applicationResumeSnapshots, eq(jobApplications.id, applicationResumeSnapshots.jobApplicationId))
    .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.candidateAccountId, candidateAccountId)))
    .limit(1);
  if (!application) return null;

  const [experiences, educations, languages] = await Promise.all([
    db.select({ jobTitle: applicationResumeSnapshotExperiences.jobTitle, companyName: applicationResumeSnapshotExperiences.companyName, startDate: applicationResumeSnapshotExperiences.startDate, endDate: applicationResumeSnapshotExperiences.endDate, isCurrent: applicationResumeSnapshotExperiences.isCurrent, description: applicationResumeSnapshotExperiences.description }).from(applicationResumeSnapshotExperiences).where(eq(applicationResumeSnapshotExperiences.jobApplicationId, applicationId)).orderBy(asc(applicationResumeSnapshotExperiences.sortOrder)),
    db.select({ fieldOfStudy: applicationResumeSnapshotEducations.fieldOfStudy, institutionName: applicationResumeSnapshotEducations.institutionName, degree: applicationResumeSnapshotEducations.degree, startDate: applicationResumeSnapshotEducations.startDate, endDate: applicationResumeSnapshotEducations.endDate, isCurrent: applicationResumeSnapshotEducations.isCurrent }).from(applicationResumeSnapshotEducations).where(eq(applicationResumeSnapshotEducations.jobApplicationId, applicationId)).orderBy(asc(applicationResumeSnapshotEducations.sortOrder)),
    db.select({ name: applicationResumeSnapshotLanguages.name, proficiency: applicationResumeSnapshotLanguages.proficiency }).from(applicationResumeSnapshotLanguages).where(eq(applicationResumeSnapshotLanguages.jobApplicationId, applicationId)).orderBy(asc(applicationResumeSnapshotLanguages.sortOrder)),
  ]);
  return { ...application, snapshotAvailable: application.snapshotApplicationId !== null, experiences, educations, languages };
}

export async function countCandidateApplications(candidateAccountId: string) {
  const [result] = await db.select({ value: count() }).from(jobApplications)
    .where(eq(jobApplications.candidateAccountId, candidateAccountId));
  return result.value;
}
