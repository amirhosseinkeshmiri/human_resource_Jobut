import assert from "node:assert/strict";
import { File as BufferFile } from "node:buffer";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { uploadCredentialDocument, deleteCredentialDocument } from "./document-service";
import { isCandidateCredentialsEnabled } from "./feature";
import {
  canAccessCandidateCredential,
  CREDENTIAL_DOCUMENT_VISIBILITY,
  CREDENTIAL_JSON_BODY_LIMIT,
  CREDENTIAL_SNAPSHOT_EXCLUDES_DOCUMENTS,
  isBoundedCredentialJson,
} from "./policy";
import {
  assertCredentialDocumentKey,
  MAX_CREDENTIAL_DOCUMENT_UPLOAD_BYTES,
  normalizeCredentialDocument,
  readCredentialDocument,
  writeCredentialDocument,
} from "./storage";
import { candidateCredentialSchema } from "./validation";

const TestFile = globalThis.File ?? BufferFile;
const validRecord = {
  recordType: "certificate",
  title: "گواهی توسعه وب",
  issuer: "مرکز آموزش نمونه",
  issueDate: "2025-01-01",
  expirationDate: "",
  credentialId: "CERT-123",
  verificationUrl: "https://example.com/verify/CERT-123",
  description: "React و TypeScript",
};

async function pngFile(type = "image/png") {
  const data = await sharp({ create: { width: 80, height: 50, channels: 3, background: "white" } })
    .withMetadata({ exif: { IFD0: { Copyright: "private" } } }).png().toBuffer();
  return new TestFile([data], "../../credential.exe", { type }) as File;
}

test("feature gate defaults disabled and requires exact true", () => {
  assert.equal(isCandidateCredentialsEnabled({}), false);
  assert.equal(isCandidateCredentialsEnabled({ CANDIDATE_CREDENTIALS_ENABLED: "TRUE" }), false);
  assert.equal(isCandidateCredentialsEnabled({ CANDIDATE_CREDENTIALS_ENABLED: "true" }), true);
});

test("structured records accept optional dates and enforce date and URL rules", () => {
  assert.equal(candidateCredentialSchema.safeParse(validRecord).success, true);
  assert.equal(candidateCredentialSchema.safeParse({ ...validRecord, issueDate: "", expirationDate: "" }).success, true);
  assert.equal(candidateCredentialSchema.safeParse({ ...validRecord, expirationDate: "2024-01-01" }).success, false);
  assert.equal(candidateCredentialSchema.safeParse({ ...validRecord, verificationUrl: "javascript:alert(1)" }).success, false);
  assert.equal(candidateCredentialSchema.safeParse({ ...validRecord, recordType: "education" }).success, false);
});

test("ownership denies anonymous, Employer-like and cross-account IDs", () => {
  assert.equal(canAccessCandidateCredential(null, "candidate-a"), false);
  assert.equal(canAccessCandidateCredential("employer-a", "candidate-a"), false);
  assert.equal(canAccessCandidateCredential("candidate-b", "candidate-a"), false);
  assert.equal(canAccessCandidateCredential("candidate-a", "candidate-a"), true);
});

test("JSON mutation input is strictly bounded", () => {
  assert.equal(isBoundedCredentialJson("{}"), true);
  assert.equal(isBoundedCredentialJson("x".repeat(CREDENTIAL_JSON_BODY_LIMIT + 1)), false);
});

test("document normalization verifies content, strips metadata and emits bounded WebP", async () => {
  const output = await normalizeCredentialDocument(await pngFile());
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.ok((metadata.width ?? 0) <= 2000);
  await assert.rejects(normalizeCredentialDocument(await pngFile("image/jpeg")), /مطابقت ندارد/);
  await assert.rejects(normalizeCredentialDocument(new TestFile(["not image"], "x.png", { type: "image/png" }) as File), /سالمی نیست/);
  await assert.rejects(normalizeCredentialDocument(new TestFile([new Uint8Array(MAX_CREDENTIAL_DOCUMENT_UPLOAD_BYTES + 1)], "x.png", { type: "image/png" }) as File), /حجم/);
});

test("storage generates opaque keys and rejects traversal", async () => {
  const previous = process.env.UPLOAD_STORAGE_DIR;
  process.env.UPLOAD_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "jobut-credential-"));
  try {
    const key = await writeCredentialDocument(await normalizeCredentialDocument(await pngFile()));
    assert.match(key, /^credential-[0-9a-f-]+\.webp$/);
    assert.ok((await readCredentialDocument(key)).length > 0);
    assert.throws(() => assertCredentialDocumentKey("../private.webp"), /معتبر نیست/);
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_STORAGE_DIR;
    else process.env.UPLOAD_STORAGE_DIR = previous;
  }
});

test("replacement and rollback cleanup preserve database/file consistency", async () => {
  const deleted: Array<string | null | undefined> = [];
  const dependencies = {
    normalize: async () => Buffer.from("new"),
    write: async () => "new.webp",
    replace: async () => ({ found: true, oldStorageKey: "old.webp" }),
    remove: async () => ({ found: true, storageKey: "new.webp" }),
    deleteFile: async (key: string | null | undefined) => { deleted.push(key); },
  };
  assert.equal(await uploadCredentialDocument("candidate-a", "credential-a", await pngFile(), dependencies), true);
  assert.equal(await deleteCredentialDocument("candidate-a", "credential-a", dependencies), true);
  assert.deepEqual(deleted, ["old.webp", "new.webp"]);

  deleted.length = 0;
  await assert.rejects(uploadCredentialDocument("candidate-a", "credential-a", await pngFile(), {
    ...dependencies,
    replace: async () => { throw new Error("database failed"); },
  }), /database failed/);
  assert.deepEqual(deleted, ["new.webp"]);
});

test("supporting documents remain private and never enter immutable snapshots", () => {
  assert.equal(CREDENTIAL_DOCUMENT_VISIBILITY, "candidate-private");
  assert.equal(CREDENTIAL_SNAPSHOT_EXCLUDES_DOCUMENTS, true);
});
