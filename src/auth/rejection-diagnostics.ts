import type { AuthFormDataInspection } from "./form-security";
import type { AuthOriginInspection } from "./origin-policy";

export type AuthSurface = "employer" | "candidate" | "admin";

export function logAuthOriginRejection(surface: AuthSurface, inspection: AuthOriginInspection) {
  console.error(JSON.stringify({
    event: "auth_request_rejected",
    reasonCode: "AUTH_ORIGIN_REJECTED",
    surface,
    originPresent: inspection.originPresent,
    hostPresent: inspection.hostPresent,
    expectedOriginConfigured: inspection.expectedOriginConfigured,
    originMatchesExpected: inspection.originMatchesExpected,
    hostMatchesExpected: inspection.hostMatchesExpected,
  }));
}

export function logAuthFormDataRejection(surface: AuthSurface, inspection: AuthFormDataInspection) {
  console.error(JSON.stringify({
    event: "auth_request_rejected",
    reasonCode: "AUTH_FORMDATA_REJECTED",
    surface,
    rejectionReason: inspection.rejectionReason,
    fieldCount: inspection.fieldCount,
    fieldNamePatterns: {
      allowed: inspection.allowedFieldCount,
      nextActionMetadata: inspection.actionMetadataFieldCount,
      unexpected: inspection.unexpectedFieldCount,
    },
  }));
}
