import "server-only";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const PROFILE_PHOTO_DIRECTORY = "candidate-profile-photos";
export const MAX_PROFILE_PHOTO_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_PROFILE_PHOTO_PIXELS = 20_000_000;
export const PROFILE_PHOTO_EDGE = 512;
const managedKey = /^photo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export class ProfilePhotoValidationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ProfilePhotoValidationError";
  }
}

export class ProfilePhotoStorageError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProfilePhotoStorageError";
  }
}

function rootDirectory() {
  const configured = process.env.UPLOAD_STORAGE_DIR?.trim();
  if (!configured || !path.isAbsolute(configured)) {
    throw new ProfilePhotoStorageError("فضای ذخیره‌سازی تصویر در دسترس نیست.", "STORAGE_NOT_CONFIGURED");
  }
  return path.resolve(configured);
}

async function photoDirectory(create: boolean) {
  const root = rootDirectory();
  await access(root, constants.R_OK | constants.W_OK);
  const realRoot = await realpath(root);
  const requested = path.join(realRoot, PROFILE_PHOTO_DIRECTORY);
  if (create) await mkdir(requested, { recursive: true, mode: 0o750 });
  const info = await lstat(requested);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new ProfilePhotoStorageError("مسیر ذخیره‌سازی تصویر امن نیست.", "UNSAFE_STORAGE_PATH");
  }
  const realDirectory = await realpath(requested);
  if (path.dirname(realDirectory) !== realRoot) {
    throw new ProfilePhotoStorageError("مسیر ذخیره‌سازی تصویر معتبر نیست.", "STORAGE_PATH_ESCAPE");
  }
  return realDirectory;
}

export function assertManagedProfilePhotoKey(storageKey: string) {
  if (!managedKey.test(storageKey) || path.basename(storageKey) !== storageKey) {
    throw new ProfilePhotoStorageError("شناسه تصویر معتبر نیست.", "INVALID_STORAGE_KEY");
  }
  return storageKey;
}

export async function normalizeProfilePhoto(file: File) {
  if (file.size < 1 || file.size > MAX_PROFILE_PHOTO_UPLOAD_BYTES) {
    throw new ProfilePhotoValidationError("حجم تصویر باید حداکثر ۳ مگابایت باشد.", "IMAGE_SIZE");
  }
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: MAX_PROFILE_PHOTO_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
      throw new ProfilePhotoValidationError("فقط تصویر معتبر JPEG، PNG یا WebP پذیرفته می‌شود.", "IMAGE_FORMAT");
    }
    const expectedMime = metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;
    if (file.type.toLowerCase() !== expectedMime) {
      throw new ProfilePhotoValidationError("نوع اعلام‌شده فایل با محتوای واقعی تصویر مطابقت ندارد.", "IMAGE_CONTENT_TYPE_MISMATCH");
    }
    if ((metadata.pages ?? 1) !== 1 || metadata.width > 8000 || metadata.height > 8000 || metadata.width * metadata.height > MAX_PROFILE_PHOTO_PIXELS) {
      throw new ProfilePhotoValidationError("تصویر متحرک یا دارای ابعاد بیش از حد مجاز پذیرفته نمی‌شود.", "IMAGE_DIMENSIONS");
    }
    // rotate() applies EXIF orientation; encoding a fresh WebP strips EXIF/GPS and other source metadata.
    const buffer = await image
      .rotate()
      .resize(PROFILE_PHOTO_EDGE, PROFILE_PHOTO_EDGE, { fit: "cover", position: "attention", withoutEnlargement: false })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    if (buffer.length > 1024 * 1024) {
      throw new ProfilePhotoValidationError("تصویر پردازش‌شده بیش از حد بزرگ است.", "NORMALIZED_IMAGE_SIZE");
    }
    return buffer;
  } catch (error) {
    if (error instanceof ProfilePhotoValidationError) throw error;
    throw new ProfilePhotoValidationError("فایل انتخاب‌شده تصویر سالمی نیست.", "IMAGE_DECODE");
  }
}

export async function writeProfilePhoto(buffer: Buffer) {
  const directory = await photoDirectory(true);
  const storageKey = `photo-${randomUUID()}.webp`;
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
    const code = (error as NodeJS.ErrnoException).code ?? "STORAGE_WRITE_FAILED";
    console.error(JSON.stringify({ event: "candidate_profile_photo_storage_failure", operation: "write", code }));
    throw new ProfilePhotoStorageError(code === "ENOSPC" ? "فضای ذخیره‌سازی کافی نیست." : "ذخیره تصویر انجام نشد.", code, { cause: error });
  } finally {
    await handle?.close();
  }
}

export async function readProfilePhoto(storageKey: string) {
  const safeKey = assertManagedProfilePhotoKey(storageKey);
  const handle = await open(path.join(await photoDirectory(false), safeKey), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile(); } finally { await handle.close(); }
}

export async function deleteProfilePhotoFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  try {
    const safeKey = assertManagedProfilePhotoKey(storageKey);
    await unlink(path.join(await photoDirectory(false), safeKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(JSON.stringify({ event: "candidate_profile_photo_storage_failure", operation: "delete", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
    }
  }
}
