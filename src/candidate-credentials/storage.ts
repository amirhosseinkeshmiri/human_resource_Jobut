import "server-only";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const CREDENTIAL_DOCUMENT_DIRECTORY = "candidate-credentials";
export const MAX_CREDENTIAL_DOCUMENT_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CREDENTIAL_DOCUMENT_PIXELS = 25_000_000;
const keyPattern = /^credential-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export class CredentialDocumentError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = "CredentialDocumentError"; }
}

function rootDirectory() {
  const configured = process.env.UPLOAD_STORAGE_DIR?.trim();
  if (!configured || !path.isAbsolute(configured)) throw new CredentialDocumentError("فضای ذخیره‌سازی در دسترس نیست.", "STORAGE_NOT_CONFIGURED");
  return path.resolve(configured);
}

async function credentialDirectory(create: boolean) {
  const root = rootDirectory();
  await access(root, constants.R_OK | constants.W_OK);
  const realRoot = await realpath(root);
  const requested = path.join(realRoot, CREDENTIAL_DOCUMENT_DIRECTORY);
  if (create) await mkdir(requested, { recursive: true, mode: 0o750 });
  const info = await lstat(requested);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new CredentialDocumentError("مسیر ذخیره‌سازی امن نیست.", "UNSAFE_STORAGE_PATH");
  const realDirectory = await realpath(requested);
  if (path.dirname(realDirectory) !== realRoot) throw new CredentialDocumentError("مسیر ذخیره‌سازی معتبر نیست.", "STORAGE_PATH_ESCAPE");
  return realDirectory;
}

export function assertCredentialDocumentKey(storageKey: string) {
  if (!keyPattern.test(storageKey) || path.basename(storageKey) !== storageKey) throw new CredentialDocumentError("شناسه فایل معتبر نیست.", "INVALID_STORAGE_KEY");
  return storageKey;
}

export async function normalizeCredentialDocument(file: File) {
  if (file.size < 1 || file.size > MAX_CREDENTIAL_DOCUMENT_UPLOAD_BYTES) throw new CredentialDocumentError("حجم فایل باید حداکثر ۵ مگابایت باشد.", "FILE_SIZE");
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: MAX_CREDENTIAL_DOCUMENT_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) {
      throw new CredentialDocumentError("فقط تصویر تک‌فریم JPEG، PNG یا WebP پذیرفته می‌شود.", "FILE_FORMAT");
    }
    const expectedMime = metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;
    if (file.type.toLowerCase() !== expectedMime) throw new CredentialDocumentError("نوع فایل با محتوای واقعی مطابقت ندارد.", "MIME_MISMATCH");
    if (metadata.width > 8000 || metadata.height > 8000 || metadata.width * metadata.height > MAX_CREDENTIAL_DOCUMENT_PIXELS) {
      throw new CredentialDocumentError("ابعاد تصویر بیش از حد مجاز است.", "FILE_DIMENSIONS");
    }
    const output = await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toBuffer();
    if (output.length > 2 * 1024 * 1024) throw new CredentialDocumentError("فایل پردازش‌شده بیش از حد بزرگ است.", "NORMALIZED_FILE_SIZE");
    return output;
  } catch (error) {
    if (error instanceof CredentialDocumentError) throw error;
    throw new CredentialDocumentError("فایل انتخاب‌شده تصویر سالمی نیست.", "FILE_DECODE");
  }
}

export async function writeCredentialDocument(buffer: Buffer) {
  const directory = await credentialDirectory(true);
  const storageKey = `credential-${randomUUID()}.webp`;
  const target = path.join(directory, storageKey);
  let handle;
  try {
    handle = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o640);
    await handle.writeFile(buffer);
    await handle.sync();
    return storageKey;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    handle = undefined;
    await unlink(target).catch(() => undefined);
    const code = (error as NodeJS.ErrnoException).code ?? "WRITE_FAILED";
    console.error(JSON.stringify({ event: "credential_document_storage_failure", operation: "write", code }));
    throw new CredentialDocumentError(code === "ENOSPC" ? "فضای ذخیره‌سازی کافی نیست." : "ذخیره مدرک انجام نشد.", code);
  } finally { await handle?.close(); }
}

export async function readCredentialDocument(storageKey: string) {
  const handle = await open(path.join(await credentialDirectory(false), assertCredentialDocumentKey(storageKey)), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile(); } finally { await handle.close(); }
}

export async function deleteCredentialDocumentFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  try { await unlink(path.join(await credentialDirectory(false), assertCredentialDocumentKey(storageKey))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(JSON.stringify({ event: "credential_document_storage_failure", operation: "delete", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
  }
}
