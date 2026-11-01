import "server-only";

export function isAdminManagementEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.ADMIN_RBAC_MANAGEMENT_ENABLED === "true";
}

export function isAdminManagementMutationAllowed(input: {
  featureEnabled: boolean;
  originTrusted: boolean;
  ownerAuthorized: boolean;
}) {
  return input.featureEnabled && input.originTrusted && input.ownerAuthorized;
}

export function isAdminAccountLoginEligible(
  status: "active" | "disabled",
  featureEnabled: boolean,
) {
  return !featureEnabled || status === "active";
}

export function shouldShowAdminManagementNavigation(input: {
  featureEnabled: boolean;
  status: "active" | "disabled" | null;
  isOwner: boolean;
}) {
  return input.featureEnabled && input.status === "active" && input.isOwner;
}
