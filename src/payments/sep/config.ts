import "server-only";

export interface SepConfig {
  appUrl: URL;
  callbackUrl: URL;
  terminalId: string;
}

function parseUrl(name: string, raw: string | undefined) {
  if (!raw) throw new Error(`${name}_MISSING`);
  try {
    return new URL(raw);
  } catch {
    throw new Error(`${name}_INVALID`);
  }
}

export function loadSepConfig(
  environment: Record<string, string | undefined> = process.env,
  nodeEnvironment = process.env.NODE_ENV,
): SepConfig {
  const appUrl = parseUrl("APP_URL", environment.APP_URL);
  const callbackUrl = parseUrl("SEP_CALLBACK_URL", environment.SEP_CALLBACK_URL);
  const terminalId = environment.SEP_TERMINAL_ID?.trim();

  if (!terminalId || terminalId.length > 100) throw new Error("SEP_TERMINAL_ID_INVALID");
  if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash) {
    throw new Error("APP_URL_INVALID");
  }
  if (appUrl.pathname !== "/" || !["http:", "https:"].includes(appUrl.protocol)) {
    throw new Error("APP_URL_INVALID");
  }
  if (
    callbackUrl.username ||
    callbackUrl.password ||
    callbackUrl.search ||
    callbackUrl.hash ||
    callbackUrl.pathname !== "/api/payments/sep/callback" ||
    !["http:", "https:"].includes(callbackUrl.protocol)
  ) {
    throw new Error("SEP_CALLBACK_URL_INVALID");
  }
  if (callbackUrl.origin !== appUrl.origin) throw new Error("SEP_CALLBACK_ORIGIN_MISMATCH");
  if (nodeEnvironment === "production" && (appUrl.protocol !== "https:" || callbackUrl.protocol !== "https:")) {
    throw new Error("PAYMENT_HTTPS_REQUIRED");
  }

  return { appUrl, callbackUrl, terminalId };
}
