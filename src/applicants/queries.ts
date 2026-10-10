import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateResumes,
  jobApplications,
  jobPosts,
  resumeEducations,
  resumeExperiences,
  resumeLanguages,
} from "@/db/schema";
import {
  EMPLOYER_APPLICANTS_PAGE_SIZE,
  getApplicantPageCount,
  isRouteId,
} from "./policy";

export async function getEmployerJobApplicants(companyId: string, jobId: string, requestedPage: number) {
  if (!isRouteId(jobId)) return null;
  const [job] = await db.select({ id: jobPosts.id, title: jobPosts.title, status: jobPosts.status })
    .from(jobPosts).where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId))).limit(1);
  if (!job) return null;

  const [totalRow] = await db.select({ value: count() }).from(jobApplications)
    .where(eq(jobApplications.jobPostId, job.id));
  const pageCount = getApplicantPageCount(totalRow.value);
  const page = Math.min(requestedPage, pageCount);
  const applications = await db.select({
    applicationId: jobApplications.id,
    firstName: candidateResumes.firstName,
    lastName: candidateResumes.lastName,
    professionalTitle: candidateResumes.professionalTitle,
    city: candidateResumes.city,
    skills: candidateResumes.skills,
    createdAt: jobApplications.createdAt,
  }).from(jobApplications)
    .innerJoin(candidateResumes, eq(jobApplications.candidateResumeId, candidateResumes.id))
    .where(eq(jobApplications.jobPostId, job.id))
    .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
    .limit(EMPLOYER_APPLICANTS_PAGE_SIZE)
    .offset((page - 1) * EMPLOYER_APPLICANTS_PAGE_SIZE);

  return { job, applications, total: totalRow.value, page, pageCount };
}

export async function getEmployerApplicantResume(companyId: string, jobId: string, applicationId: string) {
  if (!isRouteId(jobId) || !isRouteId(applicationId)) return null;
  const [result] = await db.select({
    applicationId: jobApplications.id,
    applicationCreatedAt: jobApplications.createdAt,
    jobId: jobPosts.id,
    jobTitle: jobPosts.title,
    jobStatus: jobPosts.status,
    resumeId: candidateResumes.id,
    firstName: candidateResumes.firstName,
    lastName: candidateResumes.lastName,
    city: candidateResumes.city,
    professionalTitle: candidateResumes.professionalTitle,
    professionalSummary: candidateResumes.professionalSummary,
    skills: candidateResumes.skills,
    linkedinUrl: candidateResumes.linkedinUrl,
    portfolioUrl: candidateResumes.portfolioUrl,
  }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .innerJoin(candidateResumes, eq(jobApplications.candidateResumeId, candidateResumes.id))
    .where(and(
      eq(jobApplications.id, applicationId),
      eq(jobApplications.jobPostId, jobId),
      eq(jobPosts.companyId, companyId),
    )).limit(1);
  if (!result) return null;

  const [experiences, educations, languages] = await Promise.all([
    db.select({ jobTitle: resumeExperiences.jobTitle, companyName: resumeExperiences.companyName, startDate: resumeExperiences.startDate, endDate: resumeExperiences.endDate, isCurrent: resumeExperiences.isCurrent, description: resumeExperiences.description })
      .from(resumeExperiences).where(eq(resumeExperiences.resumeId, result.resumeId)).orderBy(asc(resumeExperiences.sortOrder)),
    db.select({ fieldOfStudy: resumeEducations.fieldOfStudy, institutionName: resumeEducations.institutionName, degree: resumeEducations.degree, startDate: resumeEducations.startDate, endDate: resumeEducations.endDate, isCurrent: resumeEducations.isCurrent })
      .from(resumeEducations).where(eq(resumeEducations.resumeId, result.resumeId)).orderBy(asc(resumeEducations.sortOrder)),
    db.select({ name: resumeLanguages.name, proficiency: resumeLanguages.proficiency })
      .from(resumeLanguages).where(eq(resumeLanguages.resumeId, result.resumeId)).orderBy(asc(resumeLanguages.sortOrder)),
  ]);

  return { ...result, experiences, educations, languages };
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
