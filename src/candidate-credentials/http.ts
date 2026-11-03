import { inspectExpectedAuthOrigin } from "@/auth/origin-policy";

export const privateJsonHeaders = { "Cache-Control": "private, no-store", Pragma: "no-cache" };

export function credentialJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateJsonHeaders });
}

export function isTrustedCredentialMutation(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  return inspectExpectedAuthOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.APP_URL).trusted;
}

export async function readBoundedRequestText(request: Request, maximumBytes: number) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new Error("BODY_TOO_LARGE");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
