import { getCurrentCandidate } from "@/candidate-auth/session";
import { isCandidateProfilePhotoEnabled } from "@/candidate-profile-photo/feature";
import { getCandidateProfilePhoto } from "@/candidate-profile-photo/repository";
import { deleteCandidateProfilePhoto, uploadCandidateProfilePhoto } from "@/candidate-profile-photo/service";
import {
  MAX_PROFILE_PHOTO_UPLOAD_BYTES,
  ProfilePhotoStorageError,
  ProfilePhotoValidationError,
  readProfilePhoto,
} from "@/candidate-profile-photo/storage";
import { inspectExpectedAuthOrigin } from "@/auth/origin-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_MULTIPART_BYTES = MAX_PROFILE_PHOTO_UPLOAD_BYTES + 64 * 1024;
const privateHeaders = { "Cache-Control": "private, no-store", Pragma: "no-cache" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

function trustedMutation(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  return inspectExpectedAuthOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.APP_URL).trusted;
}

async function readBoundedMultipart(request: Request) {
  if (!request.body) throw new Error("INVALID_BODY");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type")! },
  }).formData();
}

async function authenticatedCandidate() {
  if (!isCandidateProfilePhotoEnabled()) return { response: json({ message: "این قابلیت در حال حاضر فعال نیست." }, 404) } as const;
  const candidate = await getCurrentCandidate();
  if (!candidate) return { response: json({ message: "برای مدیریت تصویر وارد حساب کارجو شوید." }, 401) } as const;
  return { candidate } as const;
}

export async function GET() {
  const authentication = await authenticatedCandidate();
  if ("response" in authentication) return authentication.response;
  try {
    const photo = await getCandidateProfilePhoto(authentication.candidate.id);
    if (!photo) return new Response(null, { status: 404, headers: privateHeaders });
    const body = await readProfilePhoto(photo.storageKey);
    return new Response(body, {
      headers: {
        ...privateHeaders,
        "Content-Type": "image/webp",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.error(JSON.stringify({ event: "candidate_profile_photo_serve_failure", code: code ?? "UNKNOWN" }));
    return new Response(null, { status: 404, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  const authentication = await authenticatedCandidate();
  if ("response" in authentication) return authentication.response;
  if (!trustedMutation(request)) return json({ message: "درخواست معتبر نیست." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return json({ message: "نوع درخواست معتبر نیست." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return json({ message: "حجم درخواست بیش از حد مجاز است." }, 413);
  }
  try {
    const formData = await readBoundedMultipart(request);
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size < 1) return json({ message: "یک تصویر انتخاب کنید." }, 400);
    if (file.size > MAX_PROFILE_PHOTO_UPLOAD_BYTES) return json({ message: "حجم تصویر باید حداکثر ۳ مگابایت باشد." }, 413);
    await uploadCandidateProfilePhoto(authentication.candidate.id, file);
    return json({ message: "تصویر پروفایل با موفقیت ذخیره شد." });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return json({ message: "حجم درخواست بیش از حد مجاز است." }, 413);
    }
    if (error instanceof ProfilePhotoValidationError || error instanceof ProfilePhotoStorageError) {
      console.warn(JSON.stringify({ event: "candidate_profile_photo_upload_rejected", code: error.code }));
      return json({ message: error.message }, error instanceof ProfilePhotoValidationError ? 400 : 503);
    }
    console.error(JSON.stringify({ event: "candidate_profile_photo_upload_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return json({ message: "ذخیره تصویر انجام نشد. دوباره تلاش کنید." }, 500);
  }
}

export async function DELETE(request: Request) {
  const authentication = await authenticatedCandidate();
  if ("response" in authentication) return authentication.response;
  if (!trustedMutation(request)) return json({ message: "درخواست معتبر نیست." }, 403);
  try {
    await deleteCandidateProfilePhoto(authentication.candidate.id);
    return json({ message: "تصویر پروفایل حذف شد." });
  } catch (error) {
    console.error(JSON.stringify({ event: "candidate_profile_photo_delete_failure", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    return json({ message: "حذف تصویر انجام نشد. دوباره تلاش کنید." }, 500);
  }
}
