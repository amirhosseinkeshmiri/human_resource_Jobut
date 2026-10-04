import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
]);

export class ImageValidationError extends Error {}

function readPngDimensions(buffer: Buffer) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature)) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > buffer.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += length + 2;
  }

  return null;
}

function imageDimensions(buffer: Buffer, type: string) {
  return type === "image/png" ? readPngDimensions(buffer) : readJpegDimensions(buffer);
}

export function selectedFiles(entries: FormDataEntryValue[]) {
  return entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export async function validateCompanyImageFile(
  file: File,
  kind: "logo" | "gallery",
) {
  const extension = allowedTypes.get(file.type);
  if (!extension || file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("تصویر باید PNG یا JPEG و حداکثر ۵ مگابایت باشد.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = imageDimensions(buffer, file.type);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw new ImageValidationError("فایل تصویر معتبر نیست.");
  }
  if (kind === "logo" && dimensions.width !== dimensions.height) {
    throw new ImageValidationError("لوگوی شرکت باید نسبت تصویر ۱:۱ داشته باشد.");
  }

  return { buffer, extension };
}

export async function saveDevelopmentCompanyImage(
  file: File,
  kind: "logo" | "gallery",
) {
  if (process.env.NODE_ENV === "production") {
    throw new ImageValidationError("ذخیره‌سازی تصویر هنوز برای محیط اصلی پیکربندی نشده است.");
  }

  const { buffer, extension } = await validateCompanyImageFile(file, kind);

  const directory = path.join(process.cwd(), "public", "dev-uploads", "company-media");
  await mkdir(directory, { recursive: true });
  const filename = `${kind}-${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), buffer, { flag: "wx" });

  return `/dev-uploads/company-media/${filename}`;
}
