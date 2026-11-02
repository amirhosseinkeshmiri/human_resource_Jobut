import "server-only";
import { LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE } from "./documents";

export function isCandidateLegalAcceptanceFeatureEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.CANDIDATE_LEGAL_ACCEPTANCE_ENABLED === "true";
}

export function isCandidateLegalAcceptanceEnforced(
  environment: Record<string, string | undefined> = process.env,
) {
  return isCandidateLegalAcceptanceFeatureEnabled(environment)
    && LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE;
}
