import assert from "node:assert/strict";
import { File as BufferFile } from "node:buffer";
import { mkdtemp, mkdir, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  deleteManagedCompanyImage,
  filenameFromManagedUrl,
  MAX_IMAGE_BYTES,
  readCompanyImage,
  saveCompanyImage,
  validateCompanyImageFile,
} from "./image-storage";
import { isPublicCompanyImageReference } from "./image-policy";

const TestFile = globalThis.File ?? BufferFile;

async function withStorage(run: (directory: string) => Promise<void>) {
  const previous = process.env.UPLOAD_STORAGE_DIR;
  const directory = await mkdtemp(path.join(tmpdir(), "jobut-images-"));
  process.env.UPLOAD_STORAGE_DIR = directory;
  try { await run(directory); } finally {
    if (previous === undefined) delete process.env.UPLOAD_STORAGE_DIR;
    else process.env.UPLOAD_STORAGE_DIR = previous;
  }
}

async function pngFile(width = 2, height = 2) {
  const buffer = await sharp({ create: { width, height, channels: 4, background: "#1570ef" } }).png().toBuffer();
  return new TestFile([buffer], "untrusted-name.exe", { type: "application/octet-stream" }) as File;
}

test("stores with a generated filename and retrieves actual image bytes", async () => withStorage(async (directory) => {
  const url = await saveCompanyImage(await pngFile(), "logo");
  const filename = filenameFromManagedUrl(url);
  assert.match(filename ?? "", /^logo-[0-9a-f-]+\.png$/);
  const served = await readCompanyImage(filename!);
  assert.deepEqual(served, await readFile(path.join(directory, "company-media", filename!)));
}));

test("validates decoded content, size, dimensions and logo shape", async () => {
  await assert.rejects(validateCompanyImageFile(new TestFile(["not an image"], "x.png", { type: "image/png" }) as File, "gallery"), /معتبر نیست/);
  await assert.rejects(validateCompanyImageFile(new TestFile([new Uint8Array(MAX_IMAGE_BYTES + 1)], "x.jpg", { type: "image/jpeg" }) as File, "gallery"), /حجم/);
  await assert.rejects(validateCompanyImageFile(await pngFile(2, 3), "logo"), /۱:۱/);
});

test("rejects traversal and symlink storage escapes", async () => withStorage(async (directory) => {
  await assert.rejects(readCompanyImage("../secret.png"), /معتبر نیست/);
  await mkdir(path.join(directory, "outside"));
  await symlink(path.join(directory, "outside"), path.join(directory, "company-media"));
  await assert.rejects(saveCompanyImage(await pngFile(), "logo"), /دیسک پایدار/);
}));

test("deletes only managed files and supports safe replacement cleanup", async () => withStorage(async () => {
  const oldUrl = await saveCompanyImage(await pngFile(), "logo");
  const newUrl = await saveCompanyImage(await pngFile(), "logo");
  await deleteManagedCompanyImage(oldUrl);
  await assert.rejects(readCompanyImage(filenameFromManagedUrl(oldUrl)!));
  assert.equal((await readCompanyImage(filenameFromManagedUrl(newUrl)!)).length > 0, true);
  await deleteManagedCompanyImage("/etc/passwd");
}));

test("public authorization requires an exact database-backed reference", () => {
  const url = "/api/images/company-media/logo-123.png";
  assert.equal(isPublicCompanyImageReference(url, [{ url }]), true);
  assert.equal(isPublicCompanyImageReference(url, [{ url: null }, { url: "/private/document.pdf" }]), false);
});
