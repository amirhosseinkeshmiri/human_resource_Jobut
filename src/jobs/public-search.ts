import { employmentTypes, seniorityLevels, workplaceTypes } from "./validation";
import { isIranProvince, sanitizeIranProvinceCity } from "@/lib/iran-cities";

export const PUBLIC_JOBS_PAGE_SIZE = 20;
export const PUBLIC_JOB_QUERY_MAX_LENGTH = 120;
export const PUBLIC_JOB_LOCATION_MAX_LENGTH = 160;
export const PUBLIC_JOB_SALARY_MAX = 2_000_000_000;
export const PUBLIC_JOBS_CLEAR_URL = "/jobs";
export const publicJobSalaryTypes = ["fixed", "negotiable"] as const;
export const publicJobSorts = ["newest", "oldest", "salary_asc", "salary_desc"] as const;
export type PublicJobSort = (typeof publicJobSorts)[number];

type SearchParamValue = string | string[] | undefined;

export interface PublicJobSearchParams {
  q?: SearchParamValue;
  province?: SearchParamValue;
  location?: SearchParamValue;
  workplace?: SearchParamValue;
  employment?: SearchParamValue;
  seniority?: SearchParamValue;
  salaryType?: SearchParamValue;
  minSalary?: SearchParamValue;
  sort?: SearchParamValue;
  page?: SearchParamValue;
}

export interface PublicJobFilters {
  q: string;
  province: string;
  location: string;
  workplace: (typeof workplaceTypes)[number] | null;
  employment: (typeof employmentTypes)[number] | null;
  seniority: (typeof seniorityLevels)[number] | null;
  salaryType: (typeof publicJobSalaryTypes)[number] | null;
  minSalary: number | null;
  sort: PublicJobSort;
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

function boundedSalary(value: SearchParamValue) {
  const normalized = first(value);
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= PUBLIC_JOB_SALARY_MAX ? amount : null;
}

export function parsePublicJobFilters(params: PublicJobSearchParams): PublicJobFilters {
  const rawPage = first(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  const salaryType = enumValue(params.salaryType, publicJobSalaryTypes);
  const rawProvince = boundedText(params.province, PUBLIC_JOB_LOCATION_MAX_LENGTH);
  const locationSelection = sanitizeIranProvinceCity(
    isIranProvince(rawProvince) ? rawProvince : "",
    boundedText(params.location, PUBLIC_JOB_LOCATION_MAX_LENGTH),
  );
  return {
    q: boundedText(params.q, PUBLIC_JOB_QUERY_MAX_LENGTH),
    province: locationSelection.province,
    location: locationSelection.city,
    workplace: enumValue(params.workplace, workplaceTypes),
    employment: enumValue(params.employment, employmentTypes),
    seniority: enumValue(params.seniority, seniorityLevels),
    salaryType,
    minSalary: salaryType === "negotiable" ? null : boundedSalary(params.minSalary),
    sort: enumValue(params.sort, publicJobSorts) ?? "newest",
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function hasPublicJobFilters(filters: PublicJobFilters) {
  return Boolean(filters.q || filters.province || filters.location || filters.workplace || filters.employment || filters.seniority || filters.salaryType || filters.minSalary !== null || filters.sort !== "newest");
}

export function buildPublicJobsHref(filters: PublicJobFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.province) params.set("province", filters.province);
  if (filters.location) params.set("location", filters.location);
  if (filters.workplace) params.set("workplace", filters.workplace);
  if (filters.employment) params.set("employment", filters.employment);
  if (filters.seniority) params.set("seniority", filters.seniority);
  if (filters.salaryType) params.set("salaryType", filters.salaryType);
  if (filters.minSalary !== null) params.set("minSalary", String(filters.minSalary));
  if (filters.sort !== "newest") params.set("sort", filters.sort);
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
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
}, filters: PublicJobFilters) {
  const keyword = filters.q.toLocaleLowerCase("fa-IR");
  return (!keyword
      || job.title.toLocaleLowerCase("fa-IR").includes(keyword)
      || job.companyName.toLocaleLowerCase("fa-IR").includes(keyword))
    && (!filters.location || job.location.trim().toLocaleLowerCase("fa-IR") === filters.location.toLocaleLowerCase("fa-IR"))
    && (!filters.workplace || job.workplace === filters.workplace)
    && (!filters.employment || job.employment === filters.employment)
    && (!filters.seniority || job.seniority === filters.seniority)
    && (!filters.salaryType || (filters.salaryType === "negotiable" ? job.salaryNegotiable === true : job.salaryNegotiable === false))
    && (filters.minSalary === null || (job.salaryNegotiable === false && job.salaryMax !== null && job.salaryMax !== undefined && job.salaryMax >= filters.minSalary));
}

export function comparePublicJobSalary(
  left: { id: string; salaryMin: number | null; salaryMax: number | null; salaryNegotiable: boolean },
  right: { id: string; salaryMin: number | null; salaryMax: number | null; salaryNegotiable: boolean },
  direction: "asc" | "desc",
) {
  if (left.salaryNegotiable !== right.salaryNegotiable) return left.salaryNegotiable ? 1 : -1;
  const multiplier = direction === "asc" ? 1 : -1;
  const minimumDifference = ((left.salaryMin ?? 0) - (right.salaryMin ?? 0)) * multiplier;
  if (minimumDifference) return minimumDifference;
  const maximumDifference = ((left.salaryMax ?? 0) - (right.salaryMax ?? 0)) * multiplier;
  if (maximumDifference) return maximumDifference;
  return right.id.localeCompare(left.id);
}
