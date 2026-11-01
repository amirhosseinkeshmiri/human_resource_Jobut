import { IMAGE_ROUTE_PREFIX } from "./image-storage";

export function managedImageUrl(filename: string) {
  return `${IMAGE_ROUTE_PREFIX}${filename}`;
}

export function isPublicCompanyImageReference(
  requestedUrl: string,
  references: readonly { url: string | null }[],
) {
  return references.some((reference) => reference.url === requestedUrl);
}
