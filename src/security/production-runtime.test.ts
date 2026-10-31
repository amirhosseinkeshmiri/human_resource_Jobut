import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const script = path.join(process.cwd(), "scripts", "verify-production-runtime.mjs");
const validEnvironment = {
  NODE_ENV: "production",
  APP_URL: "https://www.jobut.ir",
  SEP_CALLBACK_URL: "https://www.jobut.ir/api/payments/sep/callback",
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "no-reply@jobut.ir",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  OTP_RATE_LIMIT_IDENTIFIER_MAX: "3",
  OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS: "600",
  OTP_RATE_LIMIT_ACCOUNT_MAX: "3",
  OTP_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS: "600",
  OTP_RATE_LIMIT_GLOBAL_MAX: "100",
  OTP_RATE_LIMIT_GLOBAL_WINDOW_SECONDS: "60",
  OTP_RATE_LIMIT_ADMIN_IDENTIFIER_MAX: "2",
  OTP_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS: "900",
  OTP_PROVIDER_CIRCUIT_FAILURE_MAX: "5",
  OTP_PROVIDER_CIRCUIT_WINDOW_SECONDS: "300",
  OTP_IP_RATE_LIMIT_ENABLED: "false",
};

function verify(overrides: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...validEnvironment,
      ...overrides,
    } as unknown as NodeJS.ProcessEnv,
  });
}

test("accepts the canonical HTTPS production configuration", () => {
  assert.equal(verify({}).status, 0);
});

test("rejects non-production runtime modes", () => {
  const result = verify({ NODE_ENV: "running" });
  assert.notEqual(result.status, 0);
});

test("rejects insecure public URLs", () => {
  const result = verify({ APP_URL: "http://www.jobut.ir" });
  assert.notEqual(result.status, 0);
});

test("rejects a SEP callback on a different origin", () => {
  const result = verify({
    SEP_CALLBACK_URL: "https://jobut.ir/api/payments/sep/callback",
  });
  assert.notEqual(result.status, 0);
});

test("rejects production runtime without SMTP delivery", () => {
  const result = verify({ EMAIL_PROVIDER: "" });
  assert.notEqual(result.status, 0);
});

test("accepts missing proxy configuration when optional IP protection is disabled", () => {
  const result = verify({ AUTH_TRUSTED_PROXY_HOPS: "" });
  assert.equal(result.status, 0);
});

test("requires verified trusted proxy hops when optional IP protection is enabled", () => {
  const result = verify({ OTP_IP_RATE_LIMIT_ENABLED: "true", AUTH_TRUSTED_PROXY_HOPS: "" });
  assert.notEqual(result.status, 0);
});

test("rejects missing mandatory database throttle configuration", () => {
  const result = verify({ OTP_RATE_LIMIT_GLOBAL_MAX: "" });
  assert.notEqual(result.status, 0);
});
