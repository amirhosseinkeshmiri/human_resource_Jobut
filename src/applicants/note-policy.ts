import { z } from "zod";

export const EMPLOYER_NOTE_MAX_LENGTH = 2000;
export const EMPLOYER_NOTE_BROWSER_FIELDS = ["jobId", "applicationId", "note"] as const;
export const EMPLOYER_NOTE_UPDATE_FIELDS = ["employerNote"] as const;

const employerNoteSchema = z.string()
  .max(EMPLOYER_NOTE_MAX_LENGTH, "یادداشت نباید بیشتر از ۲۰۰۰ نویسه باشد.")
  .transform((value) => value.trim() || null);

export function validateEmployerNote(value: unknown) {
  return employerNoteSchema.safeParse(value);
}

export function buildEmployerNoteUpdate(employerNote: string | null) {
  return { employerNote };
}

export function canCompanyEditEmployerNote(input: {
  authenticatedCompanyId: string | null;
  jobCompanyId: string;
  requestedJobId: string;
  applicationJobId: string;
}) {
  return input.authenticatedCompanyId !== null
    && input.authenticatedCompanyId === input.jobCompanyId
    && input.requestedJobId === input.applicationJobId;
}
