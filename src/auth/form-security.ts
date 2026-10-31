export const AUTH_FORM_BODY_LIMIT = 2 * 1024;

const NEXT_SERVER_ACTION_FIELD = /^\$ACTION_(?:KEY|REF_[0-9]+|ID_[A-Za-z0-9_-]+|[0-9]+:[0-9]+)$/;

export type AuthFormDataRejectionReason =
  | "none"
  | "unexpected_field"
  | "non_string_value"
  | "body_too_large";

export interface AuthFormDataInspection {
  valid: boolean;
  fieldCount: number;
  allowedFieldCount: number;
  actionMetadataFieldCount: number;
  unexpectedFieldCount: number;
  rejectionReason: AuthFormDataRejectionReason;
}

export function inspectBoundedAuthFormData(
  formData: FormData,
  allowedFields: readonly string[],
): AuthFormDataInspection {
  const allowed = new Set(allowedFields);
  let bytes = 0;
  let fieldCount = 0;
  let allowedFieldCount = 0;
  let actionMetadataFieldCount = 0;
  let unexpectedFieldCount = 0;
  let rejectionReason: AuthFormDataRejectionReason = "none";

  for (const [key, value] of formData.entries()) {
    fieldCount += 1;
    if (allowed.has(key)) allowedFieldCount += 1;
    else if (NEXT_SERVER_ACTION_FIELD.test(key)) actionMetadataFieldCount += 1;
    else unexpectedFieldCount += 1;

    if (typeof value !== "string" && rejectionReason === "none") {
      rejectionReason = "non_string_value";
    } else if (unexpectedFieldCount > 0 && rejectionReason === "none") {
      rejectionReason = "unexpected_field";
    }

    bytes += new TextEncoder().encode(key).byteLength;
    bytes += typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.size;
    if (bytes > AUTH_FORM_BODY_LIMIT && rejectionReason === "none") {
      rejectionReason = "body_too_large";
    }
  }

  return {
    valid: rejectionReason === "none",
    fieldCount,
    allowedFieldCount,
    actionMetadataFieldCount,
    unexpectedFieldCount,
    rejectionReason,
  };
}

export function isBoundedAuthFormData(formData: FormData, allowedFields: readonly string[]) {
  return inspectBoundedAuthFormData(formData, allowedFields).valid;
}
