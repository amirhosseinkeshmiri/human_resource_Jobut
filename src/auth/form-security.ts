export const AUTH_FORM_BODY_LIMIT = 2 * 1024;

const NEXT_SERVER_ACTION_FIELD = /^\$ACTION_(?:KEY|REF_[0-9]+|ID_[A-Za-z0-9_-]+|[0-9]+:[0-9]+)$/;

export function isBoundedAuthFormData(formData: FormData, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  let bytes = 0;
  for (const [key, value] of formData.entries()) {
    if ((!allowed.has(key) && !NEXT_SERVER_ACTION_FIELD.test(key)) || typeof value !== "string") {
      return false;
    }
    bytes += new TextEncoder().encode(key).byteLength;
    bytes += new TextEncoder().encode(value).byteLength;
    if (bytes > AUTH_FORM_BODY_LIMIT) return false;
  }
  return true;
}
