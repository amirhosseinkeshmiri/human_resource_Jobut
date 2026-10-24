import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";

const MAX_TRUSTED_PROXY_HOPS = 10;

export class TrustedClientIpError extends Error {
  constructor() {
    super("trusted_client_ip_unavailable");
    this.name = "TrustedClientIpError";
  }
}

export function resolveTrustedClientIp(
  forwardedFor: string | null,
  trustedProxyHopsValue: string | undefined,
) {
  const trustedProxyHops = Number(trustedProxyHopsValue?.trim());
  if (
    !Number.isInteger(trustedProxyHops) ||
    trustedProxyHops < 1 ||
    trustedProxyHops > MAX_TRUSTED_PROXY_HOPS ||
    !forwardedFor
  ) {
    throw new TrustedClientIpError();
  }

  const chain = forwardedFor.split(",").map((entry) => entry.trim());
  if (chain.some((entry) => !isIP(entry)) || chain.length < trustedProxyHops) {
    throw new TrustedClientIpError();
  }

  // Trusted proxies append addresses on the right. Ignoring all values to the
  // left of the configured boundary prevents client-prepended XFF spoofing.
  return chain[chain.length - trustedProxyHops];
}

export async function getTrustedClientIp(
  environment: Record<string, string | undefined> = process.env,
) {
  const requestHeaders = await headers();
  return resolveTrustedClientIp(
    requestHeaders.get("x-forwarded-for"),
    environment.AUTH_TRUSTED_PROXY_HOPS,
  );
}
