import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_SECURITY_HEADERS,
  CONTENT_SECURITY_POLICY,
  HSTS_HEADER,
  PRIVATE_CACHE_HEADERS,
  PRIVATE_ROUTE_PATTERNS,
  productionSecurityHeaders,
} from "./headers";

test("CSP is restrictive and begins in report-only mode without broad script exceptions", () => {
  assert.match(CONTENT_SECURITY_POLICY, /default-src 'self'/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /form-action 'self'/);
  assert.equal(CONTENT_SECURITY_POLICY.includes("'unsafe-inline'"), false);
  assert.equal(CONTENT_SECURITY_POLICY.includes("'unsafe-eval'"), false);
  assert.equal(BASE_SECURITY_HEADERS.some((header) => header.key === "Content-Security-Policy-Report-Only"), true);
  assert.equal(BASE_SECURITY_HEADERS.some((header) => String(header.key) === "Content-Security-Policy"), false);
});

test("baseline response protections cover MIME sniffing, referrers, framing, and permissions", () => {
  assert.deepEqual(Object.fromEntries(BASE_SECURITY_HEADERS.map((header) => [header.key, header.value])), {
    "Content-Security-Policy-Report-Only": CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  });
});

test("HSTS is production-only and excludes unverified preload and subdomains", () => {
  assert.equal(productionSecurityHeaders(false, true).some((header) => header.key === "Strict-Transport-Security"), false);
  assert.equal(productionSecurityHeaders(true, false).some((header) => header.key === "Strict-Transport-Security"), false);
  assert.equal(productionSecurityHeaders(true, true).some((header) => header.key === "Strict-Transport-Security"), true);
  assert.equal(HSTS_HEADER.value.includes("includeSubDomains"), false);
  assert.equal(HSTS_HEADER.value.includes("preload"), false);
});

test("all authenticated, login, and payment routes receive private no-store policy", () => {
  assert.deepEqual(PRIVATE_ROUTE_PATTERNS, ["/admin/:path*", "/candidate/:path*", "/employer/:path*", "/login/:path*", "/api/payments/:path*"]);
  const values = Object.fromEntries(PRIVATE_CACHE_HEADERS.map((header) => [header.key, header.value]));
  assert.match(values["Cache-Control"], /private/);
  assert.match(values["Cache-Control"], /no-store/);
  assert.equal(values["CDN-Cache-Control"], "no-store");
});
