import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { candidateDataRequests, candidateDataRequestStatusEvents } from "@/db/schema";
import { isCandidateDataRequestsEnabled } from "./feature";
import {
  CANDIDATE_DATA_REQUEST_STATUSES,
  CANDIDATE_DATA_REQUEST_TYPES,
  CANDIDATE_VISIBLE_DATA_REQUEST_FIELDS,
  canCreateCandidateDataRequest,
  isActiveCandidateDataRequestStatus,
  isCandidateDataRequestStatus,
  isCandidateDataRequestType,
} from "./policy";

test("only declared request types and lifecycle statuses are valid", () => {
  assert.deepEqual(CANDIDATE_DATA_REQUEST_TYPES, ["personal_data_export", "account_deletion"]);
  assert.deepEqual(CANDIDATE_DATA_REQUEST_STATUSES, ["pending", "in_progress", "completed", "rejected", "cancelled"]);
  assert.equal(isCandidateDataRequestType("personal_data_export"), true);
  assert.equal(isCandidateDataRequestType("download_everything"), false);
  assert.equal(isCandidateDataRequestStatus("completed"), true);
  assert.equal(isCandidateDataRequestStatus("deleted"), false);
});

test("creation requires authenticated ownership, trusted origin, and enabled feature", () => {
  const base = { authenticatedCandidateId: "candidate-a", targetCandidateId: "candidate-a", requestTypeValid: true, originTrusted: true, featureEnabled: true };
  assert.equal(canCreateCandidateDataRequest(base), true);
  assert.equal(canCreateCandidateDataRequest({ ...base, targetCandidateId: "candidate-b" }), false);
  assert.equal(canCreateCandidateDataRequest({ ...base, authenticatedCandidateId: null, targetCandidateId: null }), false);
  assert.equal(canCreateCandidateDataRequest({ ...base, originTrusted: false }), false);
  assert.equal(canCreateCandidateDataRequest({ ...base, featureEnabled: false }), false);
});

test("pending and in-progress requests are active", () => {
  assert.equal(isActiveCandidateDataRequestStatus("pending"), true);
  assert.equal(isActiveCandidateDataRequestStatus("in_progress"), true);
  assert.equal(isActiveCandidateDataRequestStatus("completed"), false);
});

test("feature gate defaults disabled to protect pre-migration deployments", () => {
  assert.equal(isCandidateDataRequestsEnabled({}), false);
  assert.equal(isCandidateDataRequestsEnabled({ CANDIDATE_DATA_REQUESTS_ENABLED: "false" }), false);
  assert.equal(isCandidateDataRequestsEnabled({ CANDIDATE_DATA_REQUESTS_ENABLED: "true" }), true);
});

test("candidate-visible request records disclose no account, Resume, contact, or snapshot data", () => {
  assert.deepEqual(CANDIDATE_VISIBLE_DATA_REQUEST_FIELDS, ["id", "requestType", "status", "createdAt", "updatedAt", "resolvedAt"]);
  for (const field of ["candidateAccountId", "email", "mobile", "resume", "applicationSnapshot", "operatorNote"]) {
    assert.equal((CANDIDATE_VISIBLE_DATA_REQUEST_FIELDS as readonly string[]).includes(field), false);
  }
});

test("database enforces one active request per Candidate and type and records status events", () => {
  const requestConfig = getTableConfig(candidateDataRequests);
  const activeUnique = requestConfig.indexes.find((index) => index.config.name === "candidate_data_requests_active_type_unique");
  assert.equal(activeUnique?.config.unique, true);
  assert.notEqual(activeUnique?.config.where, undefined);
  const eventConfig = getTableConfig(candidateDataRequestStatusEvents);
  assert.equal(eventConfig.foreignKeys.length, 1);
  assert.equal(eventConfig.columns.some((column) => column.name === "occurred_at" && column.notNull), true);
});
