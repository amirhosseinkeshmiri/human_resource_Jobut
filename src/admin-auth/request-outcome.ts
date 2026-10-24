import "server-only";

import { randomUUID } from "node:crypto";
import {
  digestVerificationCode,
  generateVerificationCode,
  getAuthSecret,
} from "@/auth/crypto";
import type { AuthIdentifier } from "@/auth/identifier";

export const ADMIN_VERIFICATION_FAILURE_MESSAGE =
  "کد ورود معتبر نیست یا زمان استفاده از آن به پایان رسیده است.";

interface IssuedAdminChallenge {
  challengeId: string;
  developmentCode?: string;
}

interface AdminChallengeDependencies {
  issueKnownChallenge(): Promise<IssuedAdminChallenge>;
  authorizeUnknownIdentifier(): Promise<void>;
  developmentDelivery: boolean;
}

function createOpaqueChallenge(developmentDelivery: boolean): IssuedAdminChallenge {
  const challengeId = randomUUID();
  const code = generateVerificationCode();

  // Match the local cryptographic work of a real challenge without persisting a
  // usable record. This is a bounded timing mitigation, not an artificial delay.
  digestVerificationCode(challengeId, code, getAuthSecret());

  return {
    challengeId,
    developmentCode: developmentDelivery ? code : undefined,
  };
}

export async function issueAdminChallengeIndistinguishably(
  identifier: AuthIdentifier,
  accountExists: boolean,
  dependencies: AdminChallengeDependencies,
) {
  let issued: IssuedAdminChallenge | undefined;

  if (accountExists) {
    try {
      issued = await dependencies.issueKnownChallenge();
    } catch {
      // Provider, cooldown, limiter, and persistence failures remain private.
    }
  } else {
    try {
      await dependencies.authorizeUnknownIdentifier();
    } catch {
      // Fail closed: the public response remains opaque and no delivery occurs.
    }
  }

  const publicChallenge = issued ?? createOpaqueChallenge(dependencies.developmentDelivery);
  return {
    status: "challenge" as const,
    challengeId: publicChallenge.challengeId,
    identifier: identifier.value,
    developmentCode: publicChallenge.developmentCode,
  };
}
