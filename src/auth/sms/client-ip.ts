import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";

const MAX_TRUSTED_PROXY_HOPS = 10;

export class TrustedClientIpError extends Error {
  constructor(
    public readonly reason:
      | "missing_config"
      | "invalid_config"
      | "missing_header"
      | "invalid_chain"
      | "insufficient_chain",
    public readonly forwardedChainLength: number,
  ) {
    super("trusted_client_ip_unavailable");
    this.name = "TrustedClientIpError";
  }
}

export function resolveTrustedClientIp(
  forwardedFor: string | null,
  trustedProxyHopsValue: string | undefined,
) {
  const chain = forwardedFor
    ? forwardedFor.split(",").map((entry) => entry.trim())
    : [];
  if (trustedProxyHopsValue === undefined || trustedProxyHopsValue.trim() === "") {
    throw new TrustedClientIpError("missing_config", chain.length);
  }
  const trustedProxyHops = Number(trustedProxyHopsValue?.trim());
  if (
    !Number.isInteger(trustedProxyHops) ||
    trustedProxyHops < 1 ||
    trustedProxyHops > MAX_TRUSTED_PROXY_HOPS
  ) {
    throw new TrustedClientIpError("invalid_config", chain.length);
  }
  if (!forwardedFor) {
    throw new TrustedClientIpError("missing_header", 0);
  }
  if (chain.some((entry) => !isIP(entry))) {
    throw new TrustedClientIpError("invalid_chain", chain.length);
  }
  if (chain.length < trustedProxyHops) {
    throw new TrustedClientIpError("insufficient_chain", chain.length);
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
