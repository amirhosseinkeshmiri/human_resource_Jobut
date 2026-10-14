import {
  APPLICATION_STATUSES,
  applicationStatusLabels,
  type ApplicationStatus,
} from "@/applications/status-policy";

export const EMPLOYER_PIPELINE_LIMIT = 100;

export const PIPELINE_APPLICATION_FIELDS = [
  "applicationId",
  "firstName",
  "lastName",
  "professionalTitle",
  "city",
  "skills",
  "status",
  "createdAt",
] as const;

export const EMPLOYER_PIPELINE_CAPABILITIES = ["view", "open-application-detail"] as const;
export const PIPELINE_QUERY_SCOPE = ["companyId", "jobId"] as const;

export interface PipelineApplication {
  applicationId: string;
  firstName: string;
  lastName: string;
  professionalTitle: string;
  city: string;
  skills: string[];
  status: ApplicationStatus;
  createdAt: Date;
}

export type PipelineStatusCounts = Record<ApplicationStatus, number>;

export function emptyPipelineStatusCounts(): PipelineStatusCounts {
  return Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as PipelineStatusCounts;
}

export function buildPipelineColumns(
  applications: PipelineApplication[],
  counts: PipelineStatusCounts,
) {
  return APPLICATION_STATUSES.map((status) => ({
    status,
    label: applicationStatusLabels[status],
    count: counts[status],
    applications: applications
      .filter((application) => application.status === status)
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime()),
  }));
}

export function pipelineApplicationDetailHref(jobId: string, applicationId: string) {
  return `/employer/jobs/${jobId}/applications/${applicationId}`;
}

export function canCompanyViewJobPipeline(input: {
  authenticatedCompanyId: string;
  jobCompanyId: string;
  requestedJobId: string;
  jobId: string;
}) {
  return input.authenticatedCompanyId === input.jobCompanyId
    && input.requestedJobId === input.jobId;
}

export function isPipelineTruncated(total: number, loaded: number) {
  return total > loaded;
}
