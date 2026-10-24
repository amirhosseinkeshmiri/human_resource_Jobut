import type { NextConfig } from "next";
import {
  PRIVATE_CACHE_HEADERS,
  PRIVATE_ROUTE_PATTERNS,
  productionSecurityHeaders,
} from "./src/security/headers";

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
