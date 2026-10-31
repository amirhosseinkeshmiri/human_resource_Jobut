export function isExpectedAuthOrigin(originHeader: string | null, appUrlValue: string | undefined) {
  if (!originHeader || !appUrlValue) return false;
  try {
    const appUrl = new URL(appUrlValue);
    return appUrl.protocol === "https:" && new URL(originHeader).origin === appUrl.origin;
  } catch {
    return false;
  }
}

export interface AuthOriginInspection {
  trusted: boolean;
  originPresent: boolean;
  hostPresent: boolean;
  expectedOriginConfigured: boolean;
  originMatchesExpected: boolean;
  hostMatchesExpected: boolean;
}

export function inspectExpectedAuthOrigin(
  originHeader: string | null,
  hostHeader: string | null,
  appUrlValue: string | undefined,
): AuthOriginInspection {
  let expectedOriginConfigured = false;
  let originMatchesExpected = false;
  let hostMatchesExpected = false;
  try {
    if (appUrlValue) {
      const expected = new URL(appUrlValue);
      expectedOriginConfigured = expected.protocol === "https:";
      originMatchesExpected = Boolean(originHeader) && new URL(originHeader!).origin === expected.origin;
      hostMatchesExpected = Boolean(hostHeader) && hostHeader!.toLowerCase() === expected.host.toLowerCase();
    }
  } catch {
    // Invalid public inputs remain untrusted; diagnostics expose booleans only.
  }
  return {
    trusted: expectedOriginConfigured && originMatchesExpected,
    originPresent: Boolean(originHeader),
    hostPresent: Boolean(hostHeader),
    expectedOriginConfigured,
    originMatchesExpected,
    hostMatchesExpected,
  };
}
