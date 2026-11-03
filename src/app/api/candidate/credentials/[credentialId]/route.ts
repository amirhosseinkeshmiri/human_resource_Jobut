import { getCurrentCandidate } from "@/candidate-auth/session";
import { deleteCredentialDocumentFile } from "@/candidate-credentials/storage";
import { isCandidateCredentialsEnabled } from "@/candidate-credentials/feature";
import { credentialJson, isTrustedCredentialMutation, readBoundedRequestText } from "@/candidate-credentials/http";
import { CREDENTIAL_JSON_BODY_LIMIT, credentialIdSchema } from "@/candidate-credentials/policy";
import { deleteCandidateCredentialRecord, updateCandidateCredential } from "@/candidate-credentials/repository";
import { candidateCredentialSchema } from "@/candidate-credentials/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ credentialId: string }> };

async function boundary(request: Request, context: Context) {
  if (!isCandidateCredentialsEnabled()) return { response: credentialJson({ message: "این قابلیت فعال نیست." }, 404) } as const;
  const candidate = await getCurrentCandidate();
  if (!candidate) return { response: credentialJson({ message: "دسترسی مجاز نیست." }, 401) } as const;
  if (!isTrustedCredentialMutation(request)) return { response: credentialJson({ message: "درخواست معتبر نیست." }, 403) } as const;
  const parsedId = credentialIdSchema.safeParse((await context.params).credentialId);
  if (!parsedId.success) return { response: credentialJson({ message: "شناسه سابقه معتبر نیست." }, 404) } as const;
  return { candidate, credentialId: parsedId.data } as const;
}

export async function PATCH(request: Request, context: Context) {
  const access = await boundary(request, context);
  if ("response" in access) return access.response;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return credentialJson({ message: "نوع درخواست معتبر نیست." }, 415);
  let raw: string;
  try { raw = await readBoundedRequestText(request, CREDENTIAL_JSON_BODY_LIMIT); }
  catch { return credentialJson({ message: "حجم درخواست بیش از حد مجاز است." }, 413); }
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return credentialJson({ message: "اطلاعات معتبر نیست." }, 400); }
  const parsed = candidateCredentialSchema.safeParse(input);
  if (!parsed.success) return credentialJson({ message: parsed.error.issues[0]?.message ?? "اطلاعات معتبر نیست.", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  try {
    const updated = await updateCandidateCredential(access.candidate.id, access.credentialId, parsed.data);
    return updated ? credentialJson({ message: "سابقه ویرایش شد." }) : credentialJson({ message: "سابقه پیدا نشد." }, 404);
  } catch (error) {
    console.error(JSON.stringify({ event: "candidate_credential_update_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return credentialJson({ message: "ویرایش سابقه انجام نشد." }, 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  const access = await boundary(request, context);
  if ("response" in access) return access.response;
  try {
    const result = await deleteCandidateCredentialRecord(access.candidate.id, access.credentialId);
    if (!result.deleted) return credentialJson({ message: "سابقه پیدا نشد." }, 404);
    await deleteCredentialDocumentFile(result.storageKey);
    return credentialJson({ message: "سابقه حذف شد." });
  } catch (error) {
    console.error(JSON.stringify({ event: "candidate_credential_delete_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return credentialJson({ message: "حذف سابقه انجام نشد." }, 500);
  }
}
