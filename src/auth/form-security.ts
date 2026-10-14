export const AUTH_FORM_BODY_LIMIT = 2 * 1024;

export function isBoundedAuthFormData(formData: FormData, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  let bytes = 0;
  for (const [key, value] of formData.entries()) {
    if (!allowed.has(key) || typeof value !== "string") return false;
    bytes += new TextEncoder().encode(key).byteLength;
    bytes += new TextEncoder().encode(value).byteLength;
    if (bytes > AUTH_FORM_BODY_LIMIT) return false;
  }
  return true;
}
