import { employmentTypes, seniorityLevels, workplaceTypes } from "./validation";

export const PUBLIC_JOBS_PAGE_SIZE = 20;
export const PUBLIC_JOB_QUERY_MAX_LENGTH = 120;
export const PUBLIC_JOB_LOCATION_MAX_LENGTH = 160;
export const PUBLIC_JOBS_CLEAR_URL = "/jobs";

type SearchParamValue = string | string[] | undefined;

export interface PublicJobSearchParams {
  q?: SearchParamValue;
  location?: SearchParamValue;
  workplace?: SearchParamValue;
  employment?: SearchParamValue;
  seniority?: SearchParamValue;
  page?: SearchParamValue;
}

export interface PublicJobFilters {
  q: string;
  location: string;
  workplace: (typeof workplaceTypes)[number] | null;
  employment: (typeof employmentTypes)[number] | null;
  seniority: (typeof seniorityLevels)[number] | null;
  page: number;
}

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function boundedText(value: SearchParamValue, maximum: number) {
  const normalized = first(value)?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.length <= maximum ? normalized : "";
}

function enumValue<const T extends readonly string[]>(value: SearchParamValue, values: T): T[number] | null {
  const normalized = first(value);
  return normalized && values.includes(normalized) ? normalized as T[number] : null;
}

export function parsePublicJobFilters(params: PublicJobSearchParams): PublicJobFilters {
  const rawPage = first(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    q: boundedText(params.q, PUBLIC_JOB_QUERY_MAX_LENGTH),
    location: boundedText(params.location, PUBLIC_JOB_LOCATION_MAX_LENGTH),
    workplace: enumValue(params.workplace, workplaceTypes),
    employment: enumValue(params.employment, employmentTypes),
    seniority: enumValue(params.seniority, seniorityLevels),
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function hasPublicJobFilters(filters: PublicJobFilters) {
  return Boolean(filters.q || filters.location || filters.workplace || filters.employment || filters.seniority);
}

export function buildPublicJobsHref(filters: PublicJobFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.location) params.set("location", filters.location);
  if (filters.workplace) params.set("workplace", filters.workplace);
  if (filters.employment) params.set("employment", filters.employment);
  if (filters.seniority) params.set("seniority", filters.seniority);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/jobs?${query}` : PUBLIC_JOBS_CLEAR_URL;
}

export function getPublicJobsPageCount(total: number) {
  return Math.max(1, Math.ceil(total / PUBLIC_JOBS_PAGE_SIZE));
}

export function getPublicJobsOffset(page: number) {
  return (page - 1) * PUBLIC_JOBS_PAGE_SIZE;
}

export function matchesPublicJobFilters(job: {
  title: string;
  companyName: string;
  location: string;
  workplace: (typeof workplaceTypes)[number];
  employment: (typeof employmentTypes)[number];
  seniority: (typeof seniorityLevels)[number];
}, filters: PublicJobFilters) {
  const keyword = filters.q.toLocaleLowerCase("fa-IR");
  return (!keyword
      || job.title.toLocaleLowerCase("fa-IR").includes(keyword)
      || job.companyName.toLocaleLowerCase("fa-IR").includes(keyword))
    && (!filters.location || job.location.trim().toLocaleLowerCase("fa-IR") === filters.location.toLocaleLowerCase("fa-IR"))
    && (!filters.workplace || job.workplace === filters.workplace)
    && (!filters.employment || job.employment === filters.employment)
    && (!filters.seniority || job.seniority === filters.seniority);
}
