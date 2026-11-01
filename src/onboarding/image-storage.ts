import "server-only";
import { constants } from "node:fs";
import { access, lstat, mkdir, open, realpath, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const IMAGE_ROUTE_PREFIX = "/api/images/company-media/";
const storageSubdirectory = "company-media";
const managedFilename = /^(logo|gallery)-[0-9a-f]{8}-[0-9a-f-]{27,}\.(png|jpg)$/;
const formats = { png: { extension: "png", contentType: "image/png" }, jpeg: { extension: "jpg", contentType: "image/jpeg" } } as const;

export class ImageValidationError extends Error {
  constructor(message: string, readonly code = "IMAGE_VALIDATION") { super(message); this.name = "ImageValidationError"; }
}
export class ImageStorageError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) { super(message, options); this.name = "ImageStorageError"; }
}

function storageRoot() {
  const configured = process.env.UPLOAD_STORAGE_DIR?.trim();
  if (!configured || !path.isAbsolute(configured)) {
    throw new ImageStorageError("UPLOAD_STORAGE_DIR باید یک مسیر مطلق برای دیسک پایدار باشد.", "STORAGE_NOT_CONFIGURED");
  }
  return path.resolve(configured);
}

function logStorageFailure(operation: string, error: unknown) {
  const nodeError = error as NodeJS.ErrnoException;
  console.error(JSON.stringify({ event: "image_storage_failure", operation, code: error instanceof ImageStorageError || error instanceof ImageValidationError ? error.code : nodeError?.code ?? "UNKNOWN" }));
}

async function mediaDirectory(create = false) {
  const root = storageRoot();
  await access(root, constants.R_OK | constants.W_OK);
  const rootReal = await realpath(root);
  const requested = path.join(rootReal, storageSubdirectory);
  if (create) await mkdir(requested, { recursive: true, mode: 0o750 });
  const info = await lstat(requested);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new ImageStorageError("مسیر ذخیره تصاویر امن نیست.", "UNSAFE_STORAGE_PATH");
  const directoryReal = await realpath(requested);
  if (path.dirname(directoryReal) !== rootReal) throw new ImageStorageError("مسیر ذخیره تصاویر خارج از دیسک مجاز است.", "STORAGE_PATH_ESCAPE");
  return directoryReal;
}

function checkedFilename(filename: string) {
  if (!managedFilename.test(filename) || path.basename(filename) !== filename) throw new ImageStorageError("شناسه تصویر معتبر نیست.", "INVALID_IMAGE_PATH");
  return filename;
}

export function selectedFiles(entries: FormDataEntryValue[]) {
  return entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export async function validateCompanyImageFile(
  file: File,
  kind: "logo" | "gallery",
) {
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) throw new ImageValidationError("حجم تصویر باید حداکثر ۵ مگابایت باشد.", "IMAGE_SIZE");
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(buffer, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS });
    const metadata = await image.metadata();
    const format = metadata.format === "png" || metadata.format === "jpeg" ? formats[metadata.format] : null;
    if (!format || !metadata.width || !metadata.height || (metadata.pages !== undefined && metadata.pages !== 1)) throw new ImageValidationError("فقط تصویر تک‌فریم PNG یا JPEG معتبر پذیرفته می‌شود.", "IMAGE_FORMAT");
    if (metadata.width > 6000 || metadata.height > 6000 || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new ImageValidationError("ابعاد تصویر بیش از حد مجاز است.", "IMAGE_DIMENSIONS");
    if (kind === "logo" && metadata.width !== metadata.height) throw new ImageValidationError("لوگوی شرکت باید نسبت تصویر ۱:۱ داشته باشد.", "LOGO_ASPECT_RATIO");
    await image.clone().raw().toBuffer();
    return { buffer, ...format };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("فایل تصویر معتبر نیست.", "IMAGE_DECODE");
  }
}

export async function saveCompanyImage(file: File, kind: "logo" | "gallery") {
  const { buffer, extension } = await validateCompanyImageFile(file, kind);
  let handle;
  let target: string | undefined;
  try {
    const directory = await mediaDirectory(true);
    const filename = `${kind}-${randomUUID()}.${extension}`;
    target = path.join(directory, filename);
    handle = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o640);
    await handle.writeFile(buffer);
    await handle.sync();
    return `${IMAGE_ROUTE_PREFIX}${filename}`;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    handle = undefined;
    if (target) await unlink(target).catch(() => undefined);
    logStorageFailure("write", error);
    const code = (error as NodeJS.ErrnoException)?.code;
    throw new ImageStorageError(code === "ENOSPC" ? "فضای دیسک ذخیره تصاویر کافی نیست." : "ذخیره تصویر روی دیسک پایدار انجام نشد.", code ?? "STORAGE_WRITE_FAILED", { cause: error });
  } finally {
    await handle?.close();
  }
}

export function filenameFromManagedUrl(url: string | null | undefined) {
  if (!url?.startsWith(IMAGE_ROUTE_PREFIX)) return null;
  try { return checkedFilename(url.slice(IMAGE_ROUTE_PREFIX.length)); } catch { return null; }
}

export async function readCompanyImage(filename: string) {
  const safeName = checkedFilename(filename);
  const directory = await mediaDirectory(false);
  const handle = await open(path.join(directory, safeName), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile(); } finally { await handle.close(); }
}

export async function deleteManagedCompanyImage(url: string | null | undefined) {
  const filename = filenameFromManagedUrl(url);
  if (!filename) return;
  try { await unlink(path.join(await mediaDirectory(false), filename)); }
  catch (error) { if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") logStorageFailure("delete", error); }
}

export async function getStorageDiagnostics() {
  const root = storageRoot();
  await access(root, constants.R_OK | constants.W_OK);
  const stats = await statfs(root);
  return { root, availableBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
}
