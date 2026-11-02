export type BrowserAccountRole = "candidate" | "employer";
export type BrowserAccountContext = BrowserAccountRole | "anonymous" | "conflict";

export function resolveBrowserAccountContext(input: {
  candidateSessionValid: boolean;
  employerSessionValid: boolean;
}): BrowserAccountContext {
  if (input.candidateSessionValid && input.employerSessionValid) return "conflict";
  if (input.candidateSessionValid) return "candidate";
  if (input.employerSessionValid) return "employer";
  return "anonymous";
}

export function canStartRoleAuthentication(
  context: BrowserAccountContext,
  intendedRole: BrowserAccountRole,
) {
  return context === "anonymous" || context === intendedRole;
}

export function candidateDisplayName(firstName?: string | null, lastName?: string | null) {
  const name = [firstName, lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
  return name || "حساب کارجو";
}

export function employerDisplayName(companyName?: string | null) {
  return companyName?.trim() || "حساب کارفرما";
}
