import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { candidateLegalAcceptances } from "@/db/schema";
import { CURRENT_LEGAL_DOCUMENTS, LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE } from "./documents";
import { isCandidateLegalAcceptanceEnforced, isCandidateLegalAcceptanceFeatureEnabled } from "./feature";
import { canRecordCandidateLegalAcceptance, hasAcceptedDocumentVersions } from "./policy";

test("legal acceptance requires two explicit unchecked-by-default affirmations", () => {
  const base = { authenticatedCandidateId: "candidate-a", targetCandidateId: "candidate-a", originTrusted: true, featureEnabled: true, documentsApproved: true };
  assert.equal(canRecordCandidateLegalAcceptance({ ...base, termsAffirmed: false, privacyAffirmed: true }), false);
  assert.equal(canRecordCandidateLegalAcceptance({ ...base, termsAffirmed: true, privacyAffirmed: false }), false);
  assert.equal(canRecordCandidateLegalAcceptance({ ...base, termsAffirmed: true, privacyAffirmed: true }), true);
});

test("acceptance is bound to the authenticated Candidate and trusted origin", () => {
  const base = { authenticatedCandidateId: "candidate-a", termsAffirmed: true, privacyAffirmed: true, featureEnabled: true, documentsApproved: true };
  assert.equal(canRecordCandidateLegalAcceptance({ ...base, targetCandidateId: "candidate-b", originTrusted: true }), false);
  assert.equal(canRecordCandidateLegalAcceptance({ ...base, targetCandidateId: "candidate-a", originTrusted: false }), false);
  assert.equal(canRecordCandidateLegalAcceptance({ ...base, authenticatedCandidateId: null, targetCandidateId: null, originTrusted: true }), false);
});

test("only exact current document versions satisfy enforcement and future versions require re-acceptance", () => {
  const acceptance = { candidateAccountId: "candidate-a", ...CURRENT_LEGAL_DOCUMENTS };
  assert.equal(hasAcceptedDocumentVersions(acceptance, "candidate-a", CURRENT_LEGAL_DOCUMENTS), true);
  assert.equal(hasAcceptedDocumentVersions(acceptance, "candidate-a", { ...CURRENT_LEGAL_DOCUMENTS, termsVersion: "terms-next" }), false);
  assert.equal(hasAcceptedDocumentVersions(null, "candidate-a", CURRENT_LEGAL_DOCUMENTS), false);
});

test("feature defaults off and draft documents cannot enforce even if environment is enabled", () => {
  assert.equal(isCandidateLegalAcceptanceFeatureEnabled({}), false);
  assert.equal(isCandidateLegalAcceptanceFeatureEnabled({ CANDIDATE_LEGAL_ACCEPTANCE_ENABLED: "true" }), true);
  assert.equal(LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE, false);
  assert.equal(isCandidateLegalAcceptanceEnforced({ CANDIDATE_LEGAL_ACCEPTANCE_ENABLED: "true" }), false);
});

test("database schema deduplicates exact version submissions and timestamps on the server", () => {
  const config = getTableConfig(candidateLegalAcceptances);
  const versionUnique = config.uniqueConstraints.find(
    (constraint) => constraint.name === "candidate_legal_acceptances_versions_unique",
  );
  assert.deepEqual(
    versionUnique?.columns.map((column) => column.name),
    ["candidate_account_id", "terms_version", "privacy_version"],
  );
  const acceptedAt = config.columns.find((column) => column.name === "accepted_at");
  assert.equal(acceptedAt?.notNull, true);
  assert.notEqual(acceptedAt?.default, undefined);
});
