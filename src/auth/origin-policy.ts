export function isExpectedAuthOrigin(originHeader: string | null, appUrlValue: string | undefined) {
  if (!originHeader || !appUrlValue) return false;
  try {
    const appUrl = new URL(appUrlValue);
    return appUrl.protocol === "https:" && new URL(originHeader).origin === appUrl.origin;
  } catch {
    return false;
  }
}
