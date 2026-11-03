import assert from "node:assert/strict";
import { File as BufferFile } from "node:buffer";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { isCandidateProfilePhotoEnabled } from "./feature";
import { canAccessCandidateProfilePhoto } from "./policy";
import { deleteCandidateProfilePhoto, uploadCandidateProfilePhoto } from "./service";
import {
  assertManagedProfilePhotoKey,
  MAX_PROFILE_PHOTO_UPLOAD_BYTES,
  normalizeProfilePhoto,
  readProfilePhoto,
  writeProfilePhoto,
} from "./storage";

const TestFile = globalThis.File ?? BufferFile;

async function imageFile(options: { width?: number; height?: number; type?: string; metadata?: boolean } = {}) {
  const width = options.width ?? 20;
  const height = options.height ?? 20;
  let pipeline = sharp({ create: { width, height, channels: 3, background: "#1570ef" } });
  if (options.metadata) pipeline = pipeline.withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "private metadata" } } });
  const buffer = await pipeline.png().toBuffer();
  return new TestFile([buffer], "../../untrusted-name.png", { type: options.type ?? "image/png" }) as File;
}

test("feature flag is disabled by default and requires exact true", () => {
  assert.equal(isCandidateProfilePhotoEnabled({}), false);
  assert.equal(isCandidateProfilePhotoEnabled({ CANDIDATE_PROFILE_PHOTO_ENABLED: "TRUE" }), false);
  assert.equal(isCandidateProfilePhotoEnabled({ CANDIDATE_PROFILE_PHOTO_ENABLED: "true" }), true);
});

test("candidate photo ownership denies anonymous, employer-like and cross-account access", () => {
  assert.equal(canAccessCandidateProfilePhoto(null, "candidate-a"), false);
  assert.equal(canAccessCandidateProfilePhoto("employer-a", "candidate-a"), false);
  assert.equal(canAccessCandidateProfilePhoto("candidate-b", "candidate-a"), false);
  assert.equal(canAccessCandidateProfilePhoto("candidate-a", "candidate-a"), true);
});

test("normalizes a valid raster to bounded WebP and strips metadata", async () => {
  const result = await normalizeProfilePhoto(await imageFile({ metadata: true }));
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

test("rejects invalid content, MIME mismatch, oversized bytes and dimensions", async () => {
  await assert.rejects(normalizeProfilePhoto(new TestFile(["not-image"], "x.png", { type: "image/png" }) as File), /سالمی نیست/);
  await assert.rejects(normalizeProfilePhoto(await imageFile({ type: "image/jpeg" })), /مطابقت ندارد/);
  await assert.rejects(normalizeProfilePhoto(new TestFile([new Uint8Array(MAX_PROFILE_PHOTO_UPLOAD_BYTES + 1)], "x.png", { type: "image/png" }) as File), /حجم/);
  await assert.rejects(normalizeProfilePhoto(await imageFile({ width: 8001, height: 1 })), /ابعاد/);
});

test("generated storage keys ignore filenames and traversal keys are rejected", async () => {
  const previous = process.env.UPLOAD_STORAGE_DIR;
  const root = await mkdtemp(path.join(tmpdir(), "jobut-candidate-photo-"));
  process.env.UPLOAD_STORAGE_DIR = root;
  try {
    const buffer = await normalizeProfilePhoto(await imageFile());
    const storageKey = await writeProfilePhoto(buffer);
    assert.match(storageKey, /^photo-[0-9a-f-]+\.webp$/);
    assert.deepEqual(await readProfilePhoto(storageKey), await readFile(path.join(root, "candidate-profile-photos", storageKey)));
    await assert.rejects(readProfilePhoto("photo-00000000-0000-0000-0000-000000000000.webp"), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
    assert.throws(() => assertManagedProfilePhotoKey("../secret.webp"), /معتبر نیست/);
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_STORAGE_DIR;
    else process.env.UPLOAD_STORAGE_DIR = previous;
  }
});

test("replacement deletes the old file only after the database update succeeds", async () => {
  const deleted: Array<string | null | undefined> = [];
  const file = await imageFile();
  const key = await uploadCandidateProfilePhoto("candidate-a", file, {
    normalize: async () => Buffer.from("new"),
    write: async () => "new.webp",
    replace: async (candidateId, photo) => {
      assert.equal(candidateId, "candidate-a");
      assert.equal(photo.storageKey, "new.webp");
      return "old.webp";
    },
    remove: async () => null,
    deleteFile: async (value) => { deleted.push(value); },
  });
  assert.equal(key, "new.webp");
  assert.deepEqual(deleted, ["old.webp"]);
});

test("database failure cleans the new file and preserves the old reference", async () => {
  const deleted: Array<string | null | undefined> = [];
  await assert.rejects(uploadCandidateProfilePhoto("candidate-a", await imageFile(), {
    normalize: async () => Buffer.from("new"),
    write: async () => "new.webp",
    replace: async () => { throw new Error("database unavailable"); },
    remove: async () => null,
    deleteFile: async (value) => { deleted.push(value); },
  }), /database unavailable/);
  assert.deepEqual(deleted, ["new.webp"]);
});

test("delete removes only the database-returned owned storage key", async () => {
  const deleted: Array<string | null | undefined> = [];
  const removed = await deleteCandidateProfilePhoto("candidate-a", {
    normalize: async () => Buffer.alloc(0),
    write: async () => "unused",
    replace: async () => null,
    remove: async (candidateId) => candidateId === "candidate-a" ? "owned.webp" : null,
    deleteFile: async (value) => { deleted.push(value); },
  });
  assert.equal(removed, true);
  assert.deepEqual(deleted, ["owned.webp"]);
});
