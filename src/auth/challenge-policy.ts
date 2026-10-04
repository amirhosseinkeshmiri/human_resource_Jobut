export const MAX_VERIFICATION_ATTEMPTS = 5;
export const VERIFICATION_CODE_TTL_MINUTES = 10;

interface ChallengeState {
  consumedAt: Date | null;
  expiresAt: Date;
  attempts: number;
}

export type ChallengeAvailability = "available" | "consumed" | "expired" | "attempts-exhausted";

export function getChallengeAvailability(
  challenge: ChallengeState,
  now = new Date(),
): ChallengeAvailability {
  if (challenge.consumedAt) return "consumed";
  if (challenge.expiresAt.getTime() <= now.getTime()) return "expired";
  if (challenge.attempts >= MAX_VERIFICATION_ATTEMPTS) return "attempts-exhausted";
  return "available";
}
