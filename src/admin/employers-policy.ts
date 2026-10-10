export const ADMIN_EMPLOYERS_PAGE_SIZE = 20;

export const employerSortOptions = [
  "jobs_desc",
  "jobs_asc",
  "paid_desc",
  "paid_asc",
  "credits_desc",
  "credits_asc",
  "newest",
] as const;

export type EmployerSort = (typeof employerSortOptions)[number];

export interface EmployerListParams {
  page: number;
  offset: number;
  query: string;
  sort: EmployerSort;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEmployerListParams(input: {
  page?: string | string[];
  q?: string | string[];
  sort?: string | string[];
}): EmployerListParams {
  const parsedPage = Number.parseInt(firstValue(input.page) ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedSort = firstValue(input.sort);
  const sort = employerSortOptions.includes(requestedSort as EmployerSort)
    ? requestedSort as EmployerSort
    : "jobs_desc";
  const query = (firstValue(input.q) ?? "").trim().slice(0, 200);

  return {
    page,
    offset: (page - 1) * ADMIN_EMPLOYERS_PAGE_SIZE,
    query,
    sort,
  };
}

export function getPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / ADMIN_EMPLOYERS_PAGE_SIZE));
}

export function isCompanyId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
