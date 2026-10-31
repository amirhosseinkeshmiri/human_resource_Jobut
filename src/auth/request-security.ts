import "server-only";
import { headers } from "next/headers";
import { inspectExpectedAuthOrigin } from "./origin-policy";

export async function inspectTrustedAuthActionRequest() {
  if (process.env.NODE_ENV !== "production") {
    return {
      trusted: true,
      originPresent: false,
      hostPresent: false,
      expectedOriginConfigured: true,
      originMatchesExpected: true,
      hostMatchesExpected: true,
    };
  }
  const requestHeaders = await headers();
  return inspectExpectedAuthOrigin(
    requestHeaders.get("origin"),
    requestHeaders.get("host"),
    process.env.APP_URL,
  );
}

export async function isTrustedAuthActionRequest() {
  return (await inspectTrustedAuthActionRequest()).trusted;
}
