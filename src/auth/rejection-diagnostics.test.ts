import assert from "node:assert/strict";
import test from "node:test";
import { logAuthFormDataRejection, logAuthOriginRejection } from "./rejection-diagnostics";

test("authentication rejection diagnostics contain no request values", () => {
  const originalError = console.error;
  const entries: string[] = [];
  console.error = (entry?: unknown) => { entries.push(String(entry)); };
  try {
    logAuthOriginRejection("employer", {
      trusted: false,
      originPresent: true,
      hostPresent: true,
      expectedOriginConfigured: true,
      originMatchesExpected: false,
      hostMatchesExpected: false,
    });
    logAuthFormDataRejection("candidate", {
      valid: false,
      fieldCount: 6,
      allowedFieldCount: 1,
      actionMetadataFieldCount: 4,
      unexpectedFieldCount: 1,
      rejectionReason: "unexpected_field",
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(entries.length, 2);
  assert.equal(entries[0].includes("AUTH_ORIGIN_REJECTED"), true);
  assert.equal(entries[1].includes("AUTH_FORMDATA_REJECTED"), true);
  assert.equal(entries.join(" ").includes("identifier"), false);
  assert.equal(entries.join(" ").includes("@"), false);
  assert.equal(entries.join(" ").includes("$ACTION"), false);
});
