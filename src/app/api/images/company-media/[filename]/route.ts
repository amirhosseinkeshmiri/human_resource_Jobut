import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyImages } from "@/db/schema";
import { isPublicCompanyImageReference, managedImageUrl } from "@/onboarding/image-policy";
import { readCompanyImage } from "@/onboarding/image-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const requestedUrl = managedImageUrl(filename);
  try {
    const [reference] = await db
      .select({ logoUrl: companies.logoUrl, galleryUrl: companyImages.imageUrl })
      .from(companies)
      .leftJoin(companyImages, eq(companyImages.companyId, companies.id))
      .where(or(eq(companies.logoUrl, requestedUrl), eq(companyImages.imageUrl, requestedUrl)))
      .limit(1);

    if (!reference || !isPublicCompanyImageReference(requestedUrl, [{ url: reference.logoUrl }, { url: reference.galleryUrl }])) {
      return new Response("Not found", { status: 404 });
    }
    const body = await readCompanyImage(filename);
    const contentType = filename.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT" && code !== "INVALID_IMAGE_PATH") {
      console.error(JSON.stringify({ event: "image_serve_failure", code: code ?? "UNKNOWN" }));
    }
    return new Response("Not found", { status: 404 });
  }
}
