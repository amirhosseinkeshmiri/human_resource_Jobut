export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

export const BASE_SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
] as const;

export const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=31536000",
} as const;

export const PRIVATE_CACHE_HEADERS = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
] as const;

export const PRIVATE_ROUTE_PATTERNS = [
  "/admin/:path*",
  "/candidate/:path*",
  "/employer/:path*",
  "/login/:path*",
  "/api/payments/:path*",
] as const;

export function productionSecurityHeaders(isProduction: boolean, hstsEnabled: boolean) {
  return isProduction && hstsEnabled
    ? [...BASE_SECURITY_HEADERS, HSTS_HEADER]
    : [...BASE_SECURITY_HEADERS];
}
