import type { NextConfig } from "next";
import {
  PRIVATE_CACHE_HEADERS,
  PRIVATE_ROUTE_PATTERNS,
  productionSecurityHeaders,
} from "./src/security/headers";

const supportedNodeEnvironments = new Set(["development", "production", "test"]);

if (
  process.env.NODE_ENV &&
  !supportedNodeEnvironments.has(process.env.NODE_ENV)
) {
  throw new Error(
    "NODE_ENV must be one of development, production, or test. Production deployments must use NODE_ENV=production.",
  );
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Keep Next.js on the stable TypeScript compiler API. The CLI preview path
    // currently drops captured --showConfig output under the pinned Node runtime.
    useTypeScriptCli: false,
  },
  async headers() {
    const securityHeaders = productionSecurityHeaders(
      process.env.NODE_ENV === "production",
      process.env.ENABLE_HSTS === "true",
    );
    return [
      { source: "/:path*", headers: securityHeaders },
      ...PRIVATE_ROUTE_PATTERNS.map((source) => ({ source, headers: [...PRIVATE_CACHE_HEADERS] })),
    ];
  },
};

export default nextConfig;
