import assert from "node:assert/strict";
import test from "node:test";
import { sessionCookieOptions } from "./session-cookie-options";

test("session cookies are HttpOnly, SameSite Lax, root-scoped, and Secure in production", () => {
  const expiresAt = new Date("2027-01-01T00:00:00.000Z");
  assert.deepEqual(sessionCookieOptions(expiresAt, true), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  assert.equal(sessionCookieOptions(expiresAt, false).secure, false);
});
