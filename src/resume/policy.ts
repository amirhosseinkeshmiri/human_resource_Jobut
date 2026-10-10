import type { CandidateResumeValues } from "./validation";

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
