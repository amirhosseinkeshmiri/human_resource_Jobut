import { getCurrentCandidate } from "@/candidate-auth/session";
import { deleteCredentialDocument, uploadCredentialDocument } from "@/candidate-credentials/document-service";
import { isCandidateCredentialsEnabled } from "@/candidate-credentials/feature";
import { credentialJson, isTrustedCredentialMutation, privateJsonHeaders } from "@/candidate-credentials/http";
import { credentialIdSchema } from "@/candidate-credentials/policy";
import { getOwnedCredentialDocument } from "@/candidate-credentials/repository";
import {
  CredentialDocumentError,
  MAX_CREDENTIAL_DOCUMENT_UPLOAD_BYTES,
  readCredentialDocument,
} from "@/candidate-credentials/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_MULTIPART_BYTES = MAX_CREDENTIAL_DOCUMENT_UPLOAD_BYTES + 64 * 1024;
type Context = { params: Promise<{ credentialId: string }> };

async function accessBoundary(context: Context) {
  if (!isCandidateCredentialsEnabled()) return { response: credentialJson({ message: "این قابلیت فعال نیست." }, 404) } as const;
  const candidate = await getCurrentCandidate();
  if (!candidate) return { response: credentialJson({ message: "دسترسی مجاز نیست." }, 401) } as const;
  const parsed = credentialIdSchema.safeParse((await context.params).credentialId);
  if (!parsed.success) return { response: credentialJson({ message: "مدرک پیدا نشد." }, 404) } as const;
  return { candidate, credentialId: parsed.data } as const;
}

async function boundedFormData(request: Request) {
  if (!request.body) throw new Error("INVALID_BODY");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_MULTIPART_BYTES) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
}

export async function GET(_request: Request, context: Context) {
  const access = await accessBoundary(context);
  if ("response" in access) return access.response;
  try {
    const document = await getOwnedCredentialDocument(access.candidate.id, access.credentialId);
    if (!document) return new Response(null, { status: 404, headers: privateJsonHeaders });
    const body = await readCredentialDocument(document.storageKey);
    return new Response(body, { headers: {
      ...privateJsonHeaders,
      "Content-Type": "image/webp",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(JSON.stringify({ event: "credential_document_serve_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return new Response(null, { status: 404, headers: privateJsonHeaders });
  }
}

export async function POST(request: Request, context: Context) {
  const access = await accessBoundary(context);
  if ("response" in access) return access.response;
  if (!isTrustedCredentialMutation(request)) return credentialJson({ message: "درخواست معتبر نیست." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) return credentialJson({ message: "نوع درخواست معتبر نیست." }, 415);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) return credentialJson({ message: "حجم درخواست بیش از حد مجاز است." }, 413);
  try {
    const formData = await boundedFormData(request);
    const file = formData.get("document");
    if (!(file instanceof File) || file.size < 1) return credentialJson({ message: "یک تصویر انتخاب کنید." }, 400);
    const uploaded = await uploadCredentialDocument(access.candidate.id, access.credentialId, file);
    return uploaded ? credentialJson({ message: "تصویر مدرک ذخیره شد." }) : credentialJson({ message: "سابقه پیدا نشد." }, 404);
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return credentialJson({ message: "حجم درخواست بیش از حد مجاز است." }, 413);
    if (error instanceof CredentialDocumentError) return credentialJson({ message: error.message }, 400);
    console.error(JSON.stringify({ event: "credential_document_upload_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return credentialJson({ message: "ذخیره مدرک انجام نشد." }, 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  const access = await accessBoundary(context);
  if ("response" in access) return access.response;
  if (!isTrustedCredentialMutation(request)) return credentialJson({ message: "درخواست معتبر نیست." }, 403);
  const deleted = await deleteCredentialDocument(access.candidate.id, access.credentialId);
  return deleted ? credentialJson({ message: "تصویر مدرک حذف شد." }) : credentialJson({ message: "سابقه پیدا نشد." }, 404);
}
