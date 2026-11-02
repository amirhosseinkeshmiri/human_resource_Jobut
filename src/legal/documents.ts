export const CURRENT_TERMS_VERSION = "terms-2026-11-02-draft-1";
export const CURRENT_PRIVACY_VERSION = "privacy-2026-11-02-draft-1";

// The product owner must replace the placeholder pages with approved legal text,
// update both version identifiers, and explicitly change this value in a reviewed release.
export const LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE = false;

export const CURRENT_LEGAL_DOCUMENTS = {
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
} as const;
