import "server-only";

import nodemailer from "nodemailer";

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 15_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST_PATTERN = /^(?=.{1,253}$)(?!-)[a-z0-9.-]+(?<!-)$/i;

export interface SmtpConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  fromName: string;
  timeoutMs: number;
}

interface MailTransport {
  sendMail(message: Record<string, unknown>): Promise<{ accepted?: unknown[]; rejected?: unknown[] }>;
}

interface SmtpDependencies {
  createTransport(options: Record<string, unknown>): MailTransport;
}

function required(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`email_configuration_${name.toLowerCase()}`);
  return value;
}

export function readSmtpConfiguration(environment: NodeJS.ProcessEnv = process.env): SmtpConfiguration {
  const host = required(environment, "SMTP_HOST");
  const from = required(environment, "EMAIL_FROM").toLowerCase();
  const port = Number(required(environment, "SMTP_PORT"));
  const secureValue = required(environment, "SMTP_SECURE");
  const user = environment.SMTP_USER?.trim() || undefined;
  const pass = environment.SMTP_PASS || undefined;
  const timeoutMs = Number(environment.SMTP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  if (!HOST_PATTERN.test(host) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("email_configuration_server");
  }
  if (secureValue !== "true" && secureValue !== "false") {
    throw new Error("email_configuration_secure");
  }
  if ((port === 587 && secureValue !== "false") || (port === 465 && secureValue !== "true")) {
    throw new Error("email_configuration_secure");
  }
  if (!EMAIL_PATTERN.test(from) || /[\r\n]/.test(from)) {
    throw new Error("email_configuration_from");
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error("email_configuration_auth");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error("email_configuration_timeout");
  }

  const fromName = (environment.EMAIL_FROM_NAME?.trim() || "JobUT").slice(0, 80);
  if (/\r|\n/.test(fromName)) throw new Error("email_configuration_from_name");

  return { host, port, secure: secureValue === "true", user, pass, from, fromName, timeoutMs };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function buildOtpEmail(verificationCode: string) {
  if (!/^\d{6}$/.test(verificationCode)) throw new Error("email_invalid_otp");
  const code = escapeHtml(verificationCode);
  return {
    subject: "کد ورود به JobUT",
    text: `کد ورود شما به JobUT: ${verificationCode}\nاین کد ۱۰ دقیقه اعتبار دارد. اگر این درخواست از طرف شما نبوده است، این پیام را نادیده بگیرید.`,
    html: `<div dir="rtl" lang="fa"><p>کد ورود شما به JobUT:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>این کد ۱۰ دقیقه اعتبار دارد. اگر این درخواست از طرف شما نبوده است، این پیام را نادیده بگیرید.</p></div>`,
  };
}

export async function sendSmtpOtp(
  recipient: string,
  verificationCode: string,
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: SmtpDependencies = { createTransport: nodemailer.createTransport },
) {
  const normalizedRecipient = recipient.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedRecipient) || /[\r\n]/.test(normalizedRecipient)) {
    throw new Error("email_invalid_recipient");
  }

  const config = readSmtpConfiguration(environment);
  const transport = dependencies.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { minVersion: "TLSv1.2", servername: config.host },
  });
  const message = buildOtpEmail(verificationCode);
  const result = await transport.sendMail({
    envelope: { from: config.from, to: [normalizedRecipient] },
    from: { name: config.fromName, address: config.from },
    to: normalizedRecipient,
    ...message,
  });
  if (!result.accepted?.length || result.rejected?.length) {
    throw new Error("email_delivery_rejected");
  }
}
