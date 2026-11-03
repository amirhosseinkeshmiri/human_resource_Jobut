import "server-only";
import {
  buildResumePdfFilename,
  canExportOwnedResume,
  isSafeResumePdf,
  resumePdfResponseHeaders,
  type ResumePdfData,
} from "./pdf-policy";

type ResumeLoader = (candidateAccountId: string) => Promise<ResumePdfData | null>;
type ResumeRenderer = (resume: ResumePdfData) => Promise<Uint8Array>;

export async function createCandidateResumePdfResponse(input: {
  authenticatedCandidateId: string | null;
  loadResume: ResumeLoader;
  renderPdf: ResumeRenderer;
  logFailure?: (event: { event: "candidate_resume_pdf_failure"; code: string }) => void;
}) {
  if (!input.authenticatedCandidateId) return new Response("Unauthorized", { status: 401 });

  try {
    const resume = await input.loadResume(input.authenticatedCandidateId);
    if (!resume || !canExportOwnedResume(input.authenticatedCandidateId, resume.candidateAccountId)) {
      return new Response("Resume not found", { status: 404 });
    }
    const pdf = await input.renderPdf(resume);
    if (!isSafeResumePdf(pdf)) throw new Error("INVALID_PDF_OUTPUT");
    const filename = buildResumePdfFilename(resume.firstName, resume.lastName);
    const body = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(body).set(pdf);
    return new Response(body, { status: 200, headers: resumePdfResponseHeaders(filename, pdf.byteLength) });
  } catch (error) {
    input.logFailure?.({
      event: "candidate_resume_pdf_failure",
      code: error instanceof Error && error.message === "INVALID_PDF_OUTPUT" ? "INVALID_OUTPUT" : "GENERATION_FAILED",
    });
    return new Response("PDF generation failed", {
      status: 500,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
