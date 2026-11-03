import { getCurrentCandidate } from "@/candidate-auth/session";
import { getCandidateResume } from "@/resume/queries";
import { renderResumePdf } from "@/resume/pdf-document";
import { createCandidateResumePdfResponse } from "@/resume/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const candidate = await getCurrentCandidate();
  return createCandidateResumePdfResponse({
    authenticatedCandidateId: candidate?.id ?? null,
    loadResume: getCandidateResume,
    renderPdf: renderResumePdf,
    logFailure: (event) => console.error(JSON.stringify(event)),
  });
}
