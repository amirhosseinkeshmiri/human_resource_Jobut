import { pathToFileURL } from "node:url";
import { constants, accessSync, closeSync, lstatSync, mkdirSync, openSync, realpathSync, statfsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const CALLBACK_PATH = "/api/payments/sep/callback";
const COMPANY_MEDIA_DIRECTORY = "company-media";
const CANDIDATE_PROFILE_PHOTO_DIRECTORY = "candidate-profile-photos";
const CANDIDATE_CREDENTIAL_DIRECTORY = "candidate-credentials";

function verifyStorageSubdirectory(realStorageDirectory, subdirectory) {
  const directory = path.join(realStorageDirectory, subdirectory);
  mkdirSync(directory, { recursive: true, mode: 0o750 });
  const directoryInfo = lstatSync(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error(`UPLOAD_STORAGE_DIR/${subdirectory} must be a real directory, not a symlink.`);
  }
  if (realpathSync(directory) !== directory) {
    throw new Error(`UPLOAD_STORAGE_DIR/${subdirectory} must remain inside the persistent mount.`);
  }
  accessSync(directory, constants.R_OK | constants.W_OK);
  const probePath = path.join(directory, `.jobut-write-probe-${randomUUID()}`);
  let probeDescriptor;
  try {
    probeDescriptor = openSync(probePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  } finally {
    if (probeDescriptor !== undefined) closeSync(probeDescriptor);
    try { unlinkSync(probePath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
}

function readHttpsUrl(environment, name) {
  const rawValue = environment[name];
  if (!rawValue) {
    throw new Error(`${name} is required in production.`);
  }

  let value;
  try {
    value = new URL(rawValue);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (
    value.protocol !== "https:" ||
    value.username ||
    value.password ||
    value.search ||
    value.hash
  ) {
    throw new Error(`${name} must be a clean HTTPS URL without credentials, query, or fragment.`);
  }

  return value;
}

export function verifyProductionRuntime(environment = process.env) {
  if (environment.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be exactly production for the production runtime.");
  }

  const appUrl = readHttpsUrl(environment, "APP_URL");
  if (appUrl.pathname !== "/") {
    throw new Error("APP_URL must contain only the canonical origin.");
  }

  const callbackUrl = readHttpsUrl(environment, "SEP_CALLBACK_URL");
  if (callbackUrl.origin !== appUrl.origin || callbackUrl.pathname !== CALLBACK_PATH) {
    throw new Error("SEP_CALLBACK_URL must use APP_URL origin and the expected SEP callback path.");
  }

  const uploadStorageDirectory = environment.UPLOAD_STORAGE_DIR;
  if (!uploadStorageDirectory || !path.isAbsolute(uploadStorageDirectory)) {
    throw new Error("UPLOAD_STORAGE_DIR must be an absolute persistent-disk path in production.");
  }
  const resolvedStorageDirectory = path.resolve(uploadStorageDirectory);
  accessSync(resolvedStorageDirectory, constants.R_OK | constants.W_OK);
  const realStorageDirectory = realpathSync(resolvedStorageDirectory);
  if (realStorageDirectory !== resolvedStorageDirectory) {
    throw new Error("UPLOAD_STORAGE_DIR must not be a symbolic-link alias.");
  }
  verifyStorageSubdirectory(realStorageDirectory, COMPANY_MEDIA_DIRECTORY);
  if (environment.CANDIDATE_PROFILE_PHOTO_ENABLED === "true") {
    verifyStorageSubdirectory(realStorageDirectory, CANDIDATE_PROFILE_PHOTO_DIRECTORY);
  } else if (environment.CANDIDATE_PROFILE_PHOTO_ENABLED && environment.CANDIDATE_PROFILE_PHOTO_ENABLED !== "false") {
    throw new Error("CANDIDATE_PROFILE_PHOTO_ENABLED must be exactly true or false when configured.");
  }
  if (environment.CANDIDATE_CREDENTIALS_ENABLED === "true") {
    verifyStorageSubdirectory(realStorageDirectory, CANDIDATE_CREDENTIAL_DIRECTORY);
  } else if (environment.CANDIDATE_CREDENTIALS_ENABLED && environment.CANDIDATE_CREDENTIALS_ENABLED !== "false") {
    throw new Error("CANDIDATE_CREDENTIALS_ENABLED must be exactly true or false when configured.");
  }
  const storageStats = statfsSync(realStorageDirectory);
  const availableBytes = storageStats.bavail * storageStats.bsize;
  if (availableBytes < 5 * 1024 * 1024) throw new Error("UPLOAD_STORAGE_DIR has less than 5 MiB free.");

  if (environment.EMAIL_PROVIDER !== "smtp") {
    throw new Error("EMAIL_PROVIDER must be smtp in production.");
  }
  if (!environment.SMTP_HOST || /[\s/:]/.test(environment.SMTP_HOST)) {
    throw new Error("SMTP_HOST must be a valid hostname without a scheme or port.");
  }
  const smtpPort = Number(environment.SMTP_PORT);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535.");
  }
  if (!['true', 'false'].includes(environment.SMTP_SECURE ?? '')) {
    throw new Error("SMTP_SECURE must be exactly true or false.");
  }
  if ((smtpPort === 587 && environment.SMTP_SECURE !== 'false') ||
      (smtpPort === 465 && environment.SMTP_SECURE !== 'true')) {
    throw new Error("SMTP port 587 requires SMTP_SECURE=false and port 465 requires SMTP_SECURE=true.");
  }
  if (!environment.EMAIL_FROM || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.EMAIL_FROM)) {
    throw new Error("EMAIL_FROM must be a plain email address.");
  }
  if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASS)) {
    throw new Error("SMTP_USER and SMTP_PASS must either both be set or both be omitted.");
  }
  const otpIntegerVariables = [
    "OTP_RATE_LIMIT_IDENTIFIER_MAX",
    "OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS",
    "OTP_RATE_LIMIT_ACCOUNT_MAX",
    "OTP_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS",
    "OTP_RATE_LIMIT_GLOBAL_MAX",
    "OTP_RATE_LIMIT_GLOBAL_WINDOW_SECONDS",
    "OTP_RATE_LIMIT_ADMIN_IDENTIFIER_MAX",
    "OTP_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS",
    "OTP_PROVIDER_CIRCUIT_FAILURE_MAX",
    "OTP_PROVIDER_CIRCUIT_WINDOW_SECONDS",
  ];
  for (const name of otpIntegerVariables) {
    const value = environment[name];
    if (!value || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new Error(`${name} must be a positive integer in production.`);
    }
  }

  if (!['true', 'false'].includes(environment.OTP_IP_RATE_LIMIT_ENABLED ?? '')) {
    throw new Error("OTP_IP_RATE_LIMIT_ENABLED must be exactly true or false.");
  }
  if (environment.OTP_IP_RATE_LIMIT_ENABLED === "true") {
    for (const name of [
      "OTP_RATE_LIMIT_IP_MAX",
      "OTP_RATE_LIMIT_IP_WINDOW_SECONDS",
      "OTP_RATE_LIMIT_ADMIN_IP_MAX",
      "OTP_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS",
    ]) {
      const value = environment[name];
      if (!value || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`${name} must be a positive integer when IP rate limiting is enabled.`);
      }
    }
    const trustedProxyHops = Number(environment.AUTH_TRUSTED_PROXY_HOPS);
    if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1 || trustedProxyHops > 10) {
      throw new Error("AUTH_TRUSTED_PROXY_HOPS must be verified when IP rate limiting is enabled.");
    }
  }
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  try {
    verifyProductionRuntime();
    const storageStats = statfsSync(realpathSync(process.env.UPLOAD_STORAGE_DIR));
    const directories = ["company-media"];
    if (process.env.CANDIDATE_PROFILE_PHOTO_ENABLED === "true") directories.push("candidate-profile-photos");
    if (process.env.CANDIDATE_CREDENTIALS_ENABLED === "true") directories.push("candidate-credentials");
    console.log(JSON.stringify({ event: "production_runtime_verified", uploadStorage: { available: true, writable: true, directories, availableBytes: storageStats.bavail * storageStats.bsize, totalBytes: storageStats.blocks * storageStats.bsize } }));
  } catch (error) {
    console.error(JSON.stringify({ event: "production_runtime_verification_failed", code: error?.code ?? "INVALID_CONFIGURATION", message: error instanceof Error ? error.message : "Production runtime configuration is invalid." }));
    process.exitCode = 1;
  }
}
