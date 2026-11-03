import { getCurrentCandidate } from "@/candidate-auth/session";
import { isCandidateCredentialsEnabled } from "@/candidate-credentials/feature";
import { credentialJson, isTrustedCredentialMutation, readBoundedRequestText } from "@/candidate-credentials/http";
import { CREDENTIAL_JSON_BODY_LIMIT } from "@/candidate-credentials/policy";
import { createCandidateCredential } from "@/candidate-credentials/repository";
import { candidateCredentialSchema } from "@/candidate-credentials/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isCandidateCredentialsEnabled()) return credentialJson({ message: "این قابلیت فعال نیست." }, 404);
  const candidate = await getCurrentCandidate();
  if (!candidate) return credentialJson({ message: "برای ثبت سابقه وارد حساب کارجو شوید." }, 401);
  if (!isTrustedCredentialMutation(request)) return credentialJson({ message: "درخواست معتبر نیست." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return credentialJson({ message: "نوع درخواست معتبر نیست." }, 415);
  let raw: string;
  try { raw = await readBoundedRequestText(request, CREDENTIAL_JSON_BODY_LIMIT); }
  catch { return credentialJson({ message: "حجم درخواست بیش از حد مجاز است." }, 413); }
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return credentialJson({ message: "اطلاعات ارسالی معتبر نیست." }, 400); }
  const parsed = candidateCredentialSchema.safeParse(input);
  if (!parsed.success) return credentialJson({ message: parsed.error.issues[0]?.message ?? "اطلاعات معتبر نیست.", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  try {
    const record = await createCandidateCredential(candidate.id, parsed.data);
    return credentialJson({ message: "سابقه با موفقیت ثبت شد.", id: record.id }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "CREDENTIAL_LIMIT") return credentialJson({ message: "حداکثر ۲۰ سابقه قابل ثبت است." }, 409);
    console.error(JSON.stringify({ event: "candidate_credential_create_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return credentialJson({ message: "ثبت سابقه انجام نشد." }, 500);
  }
}
