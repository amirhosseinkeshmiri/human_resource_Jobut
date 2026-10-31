import assert from "node:assert/strict";
import test from "node:test";
import { buildOtpEmail, readSmtpConfiguration, sendSmtpOtp } from "./smtp";

const environment = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "jobut",
  SMTP_PASS: "secret-not-logged",
  SMTP_TIMEOUT_MS: "5000",
  EMAIL_FROM: "no-reply@jobut.ir",
  EMAIL_FROM_NAME: "JobUT",
} as unknown as NodeJS.ProcessEnv;

test("SMTP configuration requires bounded TLS-compatible values and paired credentials", () => {
  assert.equal(readSmtpConfiguration(environment).secure, true);
  assert.throws(() => readSmtpConfiguration({ ...environment, SMTP_PORT: "0" }));
  assert.equal(readSmtpConfiguration({ ...environment, SMTP_PORT: "587", SMTP_SECURE: "false" }).secure, false);
  assert.throws(() => readSmtpConfiguration({ ...environment, SMTP_PORT: "587", SMTP_SECURE: "true" }));
  assert.throws(() => readSmtpConfiguration({ ...environment, SMTP_PASS: "" }));
  assert.throws(() => readSmtpConfiguration({ ...environment, EMAIL_FROM: "bad\r\nBcc:x@y.test" }));
});

test("OTP template contains equivalent safe HTML and plain text", () => {
  const message = buildOtpEmail("012345");
  assert.match(message.text, /012345/);
  assert.match(message.html, /dir="rtl"/);
  assert.match(message.html, /012345/);
  assert.throws(() => buildOtpEmail("<script>"));
});

test("SMTP delivery validates recipient and uses the mocked transport exactly once", async () => {
  const sent: Record<string, unknown>[] = [];
  await sendSmtpOtp("USER@Example.com", "012345", environment, {
    createTransport(options) {
      assert.equal(options.disableFileAccess, true);
      assert.equal(options.disableUrlAccess, true);
      return {
        async sendMail(message) {
          sent.push(message);
          return { accepted: ["user@example.com"], rejected: [] };
        },
      };
    },
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "user@example.com");
  await assert.rejects(() => sendSmtpOtp("bad\r\nBcc:x@y.test", "012345", environment));
});

test("SMTP rejection fails closed without exposing provider details", async () => {
  await assert.rejects(() => sendSmtpOtp("user@example.com", "012345", environment, {
    createTransport() {
      return { async sendMail() { return { accepted: [], rejected: ["user@example.com"] }; } };
    },
  }), /email_delivery_rejected/);
});
