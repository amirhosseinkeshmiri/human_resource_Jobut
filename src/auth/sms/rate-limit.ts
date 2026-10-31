import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { getAuthSecret } from "../crypto";
import type { AuthIdentifier } from "../identifier";
import { db } from "@/db";
import { getTrustedClientIp } from "./client-ip";

export type SmsAuthDomain = "employer" | "candidate" | "admin";
export type OtpChannel = "sms" | "email";

export interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  key: string;
  count: number;
  limit: number;
}

export interface SmsRateLimitStore {
  consume(
    rules: readonly RateLimitRule[],
    circuitRule?: RateLimitRule,
  ): Promise<readonly RateLimitResult[]>;
  recordProviderFailure(bucketKey: string): Promise<void>;
}

export interface SmsRateLimitPolicy {
  identifierLimit: number;
  identifierWindowSeconds: number;
  accountLimit: number;
  accountWindowSeconds: number;
  ipEnabled: boolean;
  ipLimit: number;
  ipWindowSeconds: number;
  globalLimit: number;
  globalWindowSeconds: number;
  adminIdentifierLimit: number;
  adminIdentifierWindowSeconds: number;
  adminIpLimit: number;
  adminIpWindowSeconds: number;
  circuitFailureLimit: number;
  circuitWindowSeconds: number;
}

const DEFAULT_POLICY: SmsRateLimitPolicy = {
  identifierLimit: 3,
  identifierWindowSeconds: 10 * 60,
  accountLimit: 3,
  accountWindowSeconds: 10 * 60,
  ipEnabled: false,
  ipLimit: 10,
  ipWindowSeconds: 10 * 60,
  globalLimit: 100,
  globalWindowSeconds: 60,
  adminIdentifierLimit: 2,
  adminIdentifierWindowSeconds: 15 * 60,
  adminIpLimit: 4,
  adminIpWindowSeconds: 15 * 60,
  circuitFailureLimit: 5,
  circuitWindowSeconds: 5 * 60,
};

const INTEGER_POLICY_KEYS = {
  identifierLimit: "OTP_RATE_LIMIT_IDENTIFIER_MAX",
  identifierWindowSeconds: "OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS",
  accountLimit: "OTP_RATE_LIMIT_ACCOUNT_MAX",
  accountWindowSeconds: "OTP_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS",
  ipLimit: "OTP_RATE_LIMIT_IP_MAX",
  ipWindowSeconds: "OTP_RATE_LIMIT_IP_WINDOW_SECONDS",
  globalLimit: "OTP_RATE_LIMIT_GLOBAL_MAX",
  globalWindowSeconds: "OTP_RATE_LIMIT_GLOBAL_WINDOW_SECONDS",
  adminIdentifierLimit: "OTP_RATE_LIMIT_ADMIN_IDENTIFIER_MAX",
  adminIdentifierWindowSeconds: "OTP_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS",
  adminIpLimit: "OTP_RATE_LIMIT_ADMIN_IP_MAX",
  adminIpWindowSeconds: "OTP_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS",
  circuitFailureLimit: "OTP_PROVIDER_CIRCUIT_FAILURE_MAX",
  circuitWindowSeconds: "OTP_PROVIDER_CIRCUIT_WINDOW_SECONDS",
} as const;

export class SmsRateLimitExceededError extends Error {
  constructor() {
    super("otp_rate_limit_exceeded");
    this.name = "SmsRateLimitExceededError";
  }
}

export class OtpProviderCircuitOpenError extends Error {
  constructor() {
    super("otp_provider_circuit_open");
    this.name = "OtpProviderCircuitOpenError";
  }
}

export class SmsRateLimitUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("otp_rate_limit_unavailable");
    this.name = "SmsRateLimitUnavailableError";
    this.cause = cause;
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^[0-9]+$/.test(value.trim())) throw new SmsRateLimitUnavailableError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new SmsRateLimitUnavailableError();
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new SmsRateLimitUnavailableError();
}

export function loadSmsRateLimitPolicy(
  environment: Record<string, string | undefined> = process.env,
): SmsRateLimitPolicy {
  const policy = { ...DEFAULT_POLICY };
  const optionalIpProperties = new Set(["ipLimit", "ipWindowSeconds", "adminIpLimit", "adminIpWindowSeconds"]);
  for (const [property, environmentKey] of Object.entries(INTEGER_POLICY_KEYS)) {
    const key = property as keyof typeof INTEGER_POLICY_KEYS;
    if (
      environment.NODE_ENV === "production" &&
      !optionalIpProperties.has(property) &&
      !environment[environmentKey]
    ) {
      throw new SmsRateLimitUnavailableError();
    }
    policy[key] = parsePositiveInteger(environment[environmentKey], DEFAULT_POLICY[key]);
  }
  if (environment.NODE_ENV === "production" && !environment.OTP_IP_RATE_LIMIT_ENABLED) {
    throw new SmsRateLimitUnavailableError();
  }
  policy.ipEnabled = parseBoolean(environment.OTP_IP_RATE_LIMIT_ENABLED, false);
  if (environment.NODE_ENV === "production" && policy.ipEnabled) {
    for (const property of optionalIpProperties) {
      const environmentKey = INTEGER_POLICY_KEYS[property as keyof typeof INTEGER_POLICY_KEYS];
      if (!environment[environmentKey]) throw new SmsRateLimitUnavailableError();
    }
  }
  return policy;
}

function digestBucket(value: string, secret: string) {
  return createHmac("sha256", secret).update(`otp-rate-limit:v2:${value}`).digest("hex");
}

function circuitBucketKey(channel: OtpChannel) {
  return `${channel}:provider:circuit`;
}

export function buildSmsRateLimitRules(
  domain: SmsAuthDomain,
  identifier: string,
  clientIp: string | null,
  policy: SmsRateLimitPolicy,
  secret: string,
  channel: OtpChannel = "sms",
) {
  const identifierDigest = digestBucket(identifier, secret);
  const rules: RateLimitRule[] = [
    {
      key: `${channel}:login:identifier:${identifierDigest}`,
      limit: policy.identifierLimit,
      windowSeconds: policy.identifierWindowSeconds,
    },
    {
      key: `${channel}:login:account:${domain}:${identifierDigest}`,
      limit: policy.accountLimit,
      windowSeconds: policy.accountWindowSeconds,
    },
    {
      key: `${channel}:provider:global`,
      limit: policy.globalLimit,
      windowSeconds: policy.globalWindowSeconds,
    },
  ];

  if (domain === "admin") {
    rules.push({
      key: `${channel}:admin:identifier:${identifierDigest}`,
      limit: policy.adminIdentifierLimit,
      windowSeconds: policy.adminIdentifierWindowSeconds,
    });
  }

  if (policy.ipEnabled) {
    if (!clientIp) throw new SmsRateLimitUnavailableError();
    const ipDigest = digestBucket(clientIp, secret);
    rules.push({
      key: `${channel}:login:ip:${ipDigest}`,
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
    });
    if (domain === "admin") {
      rules.push({
        key: `${channel}:admin:ip:${ipDigest}`,
        limit: policy.adminIpLimit,
        windowSeconds: policy.adminIpWindowSeconds,
      });
    }
  }
  return rules;
}

function readCount(rows: unknown) {
  const row = (rows as Array<{ count: number | string }>)[0];
  const count = Number(row?.count ?? Number.NaN);
  if (!Number.isSafeInteger(count) || count < 0) throw new SmsRateLimitUnavailableError();
  return count;
}

export const postgresSmsRateLimitStore: SmsRateLimitStore = {
  async consume(rules, circuitRule) {
    if (rules.length === 0) throw new SmsRateLimitUnavailableError();
    const lockKeys = [...new Set([
      ...rules.map((rule) => rule.key),
      ...(circuitRule ? [circuitRule.key] : []),
    ])].sort();

    const results = await db.transaction(async (transaction) => {
      for (const key of lockKeys) {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      }

      if (circuitRule) {
        const rows = await transaction.execute(sql`
          select count(*)::int as count
          from otp_rate_limit_events
          where bucket_key = ${circuitRule.key}
            and event_type = 'provider_failure'
            and occurred_at > now() - make_interval(secs => ${circuitRule.windowSeconds})
        `);
        if (readCount(rows) >= circuitRule.limit) throw new OtpProviderCircuitOpenError();
      }

      const consumed: RateLimitResult[] = [];
      for (const rule of rules) {
        const rows = await transaction.execute(sql`
          select count(*)::int as count
          from otp_rate_limit_events
          where bucket_key = ${rule.key}
            and event_type = 'request'
            and occurred_at > now() - make_interval(secs => ${rule.windowSeconds})
        `);
        const previousCount = readCount(rows);
        if (previousCount >= rule.limit) throw new SmsRateLimitExceededError();
        await transaction.execute(sql`
          insert into otp_rate_limit_events (bucket_key, event_type)
          values (${rule.key}, 'request')
        `);
        consumed.push({ key: rule.key, count: previousCount + 1, limit: rule.limit });
      }
      return consumed;
    });

    await db.execute(sql`
      delete from otp_rate_limit_events
      where id in (
        select id from otp_rate_limit_events
        where occurred_at < now() - interval '1 day'
        order by occurred_at
        limit 200
      )
    `).catch(() => undefined);
    return results;
  },

  async recordProviderFailure(bucketKey) {
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${bucketKey}, 0))`);
      await transaction.execute(sql`
        insert into otp_rate_limit_events (bucket_key, event_type)
        values (${bucketKey}, 'provider_failure')
      `);
    });
  },
};

export async function enforceSmsRateLimit(
  input: {
    domain: SmsAuthDomain;
    identifier: string;
    clientIp?: string | null;
    environment?: Record<string, string | undefined>;
    channel?: OtpChannel;
  },
  store: SmsRateLimitStore = postgresSmsRateLimitStore,
) {
  try {
    const environment = input.environment ?? process.env;
    const policy = loadSmsRateLimitPolicy(environment);
    const secret = input.environment ? environment.AUTH_SECRET : getAuthSecret();
    if (!secret || secret.length < 32) throw new SmsRateLimitUnavailableError();
    const channel = input.channel ?? "sms";
    const rules = buildSmsRateLimitRules(
      input.domain,
      input.identifier,
      input.clientIp ?? null,
      policy,
      secret,
      channel,
    );
    const results = await store.consume(rules, {
      key: circuitBucketKey(channel),
      limit: policy.circuitFailureLimit,
      windowSeconds: policy.circuitWindowSeconds,
    });
    if (results.length !== rules.length || results.some((result) => result.count > result.limit)) {
      throw new SmsRateLimitUnavailableError();
    }
  } catch (error) {
    if (
      error instanceof SmsRateLimitExceededError ||
      error instanceof OtpProviderCircuitOpenError ||
      error instanceof SmsRateLimitUnavailableError
    ) throw error;
    throw new SmsRateLimitUnavailableError(error);
  }
}

export async function recordOtpProviderFailure(
  channel: OtpChannel,
  store: SmsRateLimitStore = postgresSmsRateLimitStore,
) {
  try {
    await store.recordProviderFailure(circuitBucketKey(channel));
  } catch (error) {
    if (error instanceof SmsRateLimitUnavailableError) throw error;
    throw new SmsRateLimitUnavailableError(error);
  }
}

export async function authorizeSmsChallenge(
  domain: SmsAuthDomain,
  identifier: AuthIdentifier,
) {
  const channel = identifier.type === "mobile" && process.env.SMS_PROVIDER === "melipayamak"
    ? "sms"
    : identifier.type === "email" && process.env.EMAIL_PROVIDER === "smtp"
      ? "email"
      : null;
  if (process.env.NODE_ENV !== "production" || !channel) return;

  const policy = loadSmsRateLimitPolicy();
  let clientIp: string | null = null;
  if (policy.ipEnabled) {
    clientIp = await getTrustedClientIp().catch((error) => {
      throw new SmsRateLimitUnavailableError(error);
    });
  }
  await enforceSmsRateLimit({ domain, identifier: identifier.value, clientIp, channel });
}
