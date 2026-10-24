import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { getAuthSecret } from "../crypto";
import type { AuthIdentifier } from "../identifier";
import { db } from "@/db";
import { getTrustedClientIp } from "./client-ip";

export type SmsAuthDomain = "employer" | "candidate" | "admin";

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
  consume(rules: readonly RateLimitRule[]): Promise<readonly RateLimitResult[]>;
}

interface SmsRateLimitPolicy {
  identifierLimit: number;
  identifierWindowSeconds: number;
  ipLimit: number;
  ipWindowSeconds: number;
  globalLimit: number;
  globalWindowSeconds: number;
  adminIdentifierLimit: number;
  adminIdentifierWindowSeconds: number;
  adminIpLimit: number;
  adminIpWindowSeconds: number;
}

const DEFAULT_POLICY: SmsRateLimitPolicy = {
  identifierLimit: 3,
  identifierWindowSeconds: 10 * 60,
  ipLimit: 10,
  ipWindowSeconds: 10 * 60,
  globalLimit: 100,
  globalWindowSeconds: 60,
  adminIdentifierLimit: 2,
  adminIdentifierWindowSeconds: 15 * 60,
  adminIpLimit: 4,
  adminIpWindowSeconds: 15 * 60,
};

const POLICY_ENVIRONMENT_KEYS = {
  identifierLimit: "SMS_RATE_LIMIT_IDENTIFIER_MAX",
  identifierWindowSeconds: "SMS_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS",
  ipLimit: "SMS_RATE_LIMIT_IP_MAX",
  ipWindowSeconds: "SMS_RATE_LIMIT_IP_WINDOW_SECONDS",
  globalLimit: "SMS_RATE_LIMIT_GLOBAL_MAX",
  globalWindowSeconds: "SMS_RATE_LIMIT_GLOBAL_WINDOW_SECONDS",
  adminIdentifierLimit: "SMS_RATE_LIMIT_ADMIN_IDENTIFIER_MAX",
  adminIdentifierWindowSeconds: "SMS_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS",
  adminIpLimit: "SMS_RATE_LIMIT_ADMIN_IP_MAX",
  adminIpWindowSeconds: "SMS_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS",
} as const;

export class SmsRateLimitExceededError extends Error {
  constructor() {
    super("sms_rate_limit_exceeded");
    this.name = "SmsRateLimitExceededError";
  }
}

export class SmsRateLimitUnavailableError extends Error {
  constructor() {
    super("sms_rate_limit_unavailable");
    this.name = "SmsRateLimitUnavailableError";
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^[0-9]+$/.test(value.trim())) throw new SmsRateLimitUnavailableError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new SmsRateLimitUnavailableError();
  return parsed;
}

export function loadSmsRateLimitPolicy(
  environment: Record<string, string | undefined> = process.env,
): SmsRateLimitPolicy {
  return Object.fromEntries(
    Object.entries(POLICY_ENVIRONMENT_KEYS).map(([property, environmentKey]) => [
      property,
      parsePositiveInteger(
        environment[environmentKey],
        DEFAULT_POLICY[property as keyof SmsRateLimitPolicy],
      ),
    ]),
  ) as unknown as SmsRateLimitPolicy;
}

function digestBucket(value: string, secret: string) {
  return createHmac("sha256", secret).update(`sms-rate-limit:${value}`).digest("hex");
}

export function buildSmsRateLimitRules(
  domain: SmsAuthDomain,
  identifier: string,
  clientIp: string,
  policy: SmsRateLimitPolicy,
  secret: string,
) {
  const identifierDigest = digestBucket(identifier, secret);
  const ipDigest = digestBucket(clientIp, secret);
  const rules: RateLimitRule[] = [
    {
      key: `sms:identifier:${identifierDigest}`,
      limit: policy.identifierLimit,
      windowSeconds: policy.identifierWindowSeconds,
    },
    {
      key: `sms:ip:${ipDigest}`,
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
    },
    {
      key: "sms:provider:global",
      limit: policy.globalLimit,
      windowSeconds: policy.globalWindowSeconds,
    },
  ];

  if (domain === "admin") {
    rules.push(
      {
        key: `sms:admin:identifier:${identifierDigest}`,
        limit: policy.adminIdentifierLimit,
        windowSeconds: policy.adminIdentifierWindowSeconds,
      },
      {
        key: `sms:admin:ip:${ipDigest}`,
        limit: policy.adminIpLimit,
        windowSeconds: policy.adminIpWindowSeconds,
      },
    );
  }
  return rules;
}

export const postgresSmsRateLimitStore: SmsRateLimitStore = {
  async consume(rules) {
    if (rules.length === 0) throw new SmsRateLimitUnavailableError();
    const orderedRules = [...rules].sort((left, right) => left.key.localeCompare(right.key));
    const results = await db.transaction(async (transaction) => {
      for (const rule of orderedRules) {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${rule.key}, 0))`,
        );
      }

      const results: RateLimitResult[] = [];
      for (const rule of orderedRules) {
        const rows = await transaction.execute<{ count: number }>(sql`
        insert into sms_rate_limits (
          bucket_key,
          request_count,
          window_started_at,
          expires_at
        )
        values (
          ${rule.key},
          1,
          now(),
          now() + make_interval(secs => ${rule.windowSeconds})
        )
        on conflict (bucket_key) do update set
          request_count = case
            when sms_rate_limits.expires_at <= now() then 1
            else sms_rate_limits.request_count + 1
          end,
          window_started_at = case
            when sms_rate_limits.expires_at <= now() then now()
            else sms_rate_limits.window_started_at
          end,
          expires_at = case
            when sms_rate_limits.expires_at <= now()
              then excluded.expires_at
            else sms_rate_limits.expires_at
          end
        where
          sms_rate_limits.expires_at <= now()
          or sms_rate_limits.request_count < ${rule.limit}
        returning request_count as count
        `);
        const consumed = rows[0];
        if (!consumed) throw new SmsRateLimitExceededError();
        results.push({ key: rule.key, count: consumed.count, limit: rule.limit });
      }
      return results;
    });
    await db.execute(sql`
      delete from sms_rate_limits
      where bucket_key in (
        select bucket_key
        from sms_rate_limits
        where expires_at < now() - interval '1 day'
        order by expires_at
        limit 100
      )
    `).catch(() => undefined);
    return results;
  },
};

export async function enforceSmsRateLimit(
  input: {
    domain: SmsAuthDomain;
    identifier: string;
    clientIp: string;
    environment?: Record<string, string | undefined>;
  },
  store: SmsRateLimitStore = postgresSmsRateLimitStore,
) {
  let results: readonly RateLimitResult[];
  try {
    const policy = loadSmsRateLimitPolicy(input.environment);
    const secret = input.environment
      ? input.environment.AUTH_SECRET
      : getAuthSecret();
    if (!secret || secret.length < 32) throw new SmsRateLimitUnavailableError();
    const rules = buildSmsRateLimitRules(
      input.domain,
      input.identifier,
      input.clientIp,
      policy,
      secret,
    );
    results = await store.consume(rules);
    if (results.length !== rules.length) throw new SmsRateLimitUnavailableError();
  } catch (error) {
    if (error instanceof SmsRateLimitExceededError) throw error;
    if (error instanceof SmsRateLimitUnavailableError) throw error;
    throw new SmsRateLimitUnavailableError();
  }

  if (results.some((result) => result.count > result.limit)) {
    throw new SmsRateLimitExceededError();
  }
}

export async function authorizeSmsChallenge(
  domain: SmsAuthDomain,
  identifier: AuthIdentifier,
) {
  if (
    identifier.type !== "mobile" ||
    process.env.NODE_ENV !== "production" ||
    process.env.SMS_PROVIDER !== "melipayamak"
  ) {
    return;
  }

  const clientIp = await getTrustedClientIp().catch(() => {
    throw new SmsRateLimitUnavailableError();
  });
  await enforceSmsRateLimit({ domain, identifier: identifier.value, clientIp });
}
