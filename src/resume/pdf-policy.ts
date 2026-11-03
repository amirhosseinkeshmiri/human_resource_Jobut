import { languageProficiencyLabels, type languageProficiencies } from "./validation";

export const RESUME_PDF_MAX_BYTES = 8 * 1024 * 1024;
export const RESUME_PDF_CONTENT_TYPE = "application/pdf";
export const RESUME_PDF_PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

type LanguageProficiency = (typeof languageProficiencies)[number];

export type ResumePdfData = {
  candidateAccountId: string;
  firstName: string;
  lastName: string;
  city: string;
  professionalTitle: string;
  professionalSummary: string;
  skills: string[];
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  experiences: Array<{
    id: string;
    jobTitle: string;
    companyName: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
  }>;
  educations: Array<{
    id: string;
    fieldOfStudy: string;
    institutionName: string;
    degree: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
  }>;
  languages: Array<{
    id: string;
    name: string;
    proficiency: LanguageProficiency;
  }>;
  credentials: Array<{
    id: string;
    recordType: "certificate" | "training_course" | "supporting_credential";
    title: string;
    issuer: string;
    issueDate: string | null;
    expirationDate: string | null;
    credentialId: string | null;
    verificationUrl: string | null;
    description: string | null;
  }>;
};

const unsafeFilenameCharacters = /[\u0000-\u001f\u007f/\\:*?"<>|\u202a-\u202e\u2066-\u2069]/g;

export function buildResumePdfFilename(firstName: string, lastName: string) {
  const candidateName = `${firstName} ${lastName}`
    .replace(unsafeFilenameCharacters, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return candidateName ? `رزومه-${candidateName}-JobUT.pdf` : "resume-JobUT.pdf";
}

export function buildResumePdfContentDisposition(filename: string) {
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="jobut-resume.pdf"; filename*=UTF-8''${encoded}`;
}

export function resumePdfResponseHeaders(filename: string, byteLength: number) {
  return {
    "Content-Type": RESUME_PDF_CONTENT_TYPE,
    "Content-Length": String(byteLength),
    "Content-Disposition": buildResumePdfContentDisposition(filename),
    "Cache-Control": RESUME_PDF_PRIVATE_CACHE_CONTROL,
    "CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  } as const;
}

export function canExportOwnedResume(authenticatedCandidateId: string | null, resumeCandidateId: string) {
  return authenticatedCandidateId !== null && authenticatedCandidateId === resumeCandidateId;
}

export function isSafeResumePdf(buffer: Uint8Array) {
  return buffer.byteLength > 8
    && buffer.byteLength <= RESUME_PDF_MAX_BYTES
    && new TextDecoder("ascii").decode(buffer.slice(0, 5)) === "%PDF-";
}

export function safeResumeLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function languageLabel(proficiency: LanguageProficiency) {
  return languageProficiencyLabels[proficiency];
}

export function isolateResumeRtlText(value: string) {
  return /[\u0600-\u06ff]/u.test(value) ? `\u202b${value}\u202c` : value;
}
