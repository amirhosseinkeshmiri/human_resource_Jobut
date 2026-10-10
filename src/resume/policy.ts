import type { CandidateResumeValues } from "./validation";
import { candidateResumeSchema } from "./validation";

export function canCandidateUpdateResume(authenticatedCandidateId: string, resumeCandidateId: string) {
  return authenticatedCandidateId === resumeCandidateId;
}

export function buildResumePersistencePlan(candidateAccountId: string, values: CandidateResumeValues) {
  const { experiences, educations, languages, ...resume } = values;
  return {
    resume: { candidateAccountId, ...resume },
    experiences: experiences.map((experience, sortOrder) => ({ ...experience, sortOrder })),
    educations: educations.map((education, sortOrder) => ({ ...education, sortOrder })),
    languages: languages.map((language, sortOrder) => ({ ...language, sortOrder })),
  };
}

export function isStoredResumeComplete(resume: {
  firstName: string;
  lastName: string;
  city: string;
  professionalTitle: string;
  professionalSummary: string;
  skills: string[];
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  experiences: Array<{ jobTitle: string; companyName: string; startDate: string; endDate: string | null; isCurrent: boolean; description: string | null }>;
  educations: Array<{ fieldOfStudy: string; institutionName: string; degree: string; startDate: string; endDate: string | null; isCurrent: boolean }>;
  languages: Array<{ name: string; proficiency: "basic" | "intermediate" | "advanced" | "fluent" | "native" }>;
}) {
  return candidateResumeSchema.safeParse({
    firstName: resume.firstName,
    lastName: resume.lastName,
    city: resume.city,
    professionalTitle: resume.professionalTitle,
    professionalSummary: resume.professionalSummary,
    skills: resume.skills,
    linkedinUrl: resume.linkedinUrl ?? "",
    portfolioUrl: resume.portfolioUrl ?? "",
    experiences: resume.experiences.map((item) => ({ ...item, endDate: item.endDate ?? "", description: item.description ?? "" })),
    educations: resume.educations.map((item) => ({ ...item, endDate: item.endDate ?? "" })),
    languages: resume.languages,
  }).success;
}
