export const BRAND_NAME_EN = "Jobokar";
export const BRAND_NAME_FA = "جابوکار";
export const BRAND_DESCRIPTION_FA = "سامانه کاریابی و استخدام برای ارتباط کارجویان و کارفرمایان";
export const STAGE_A_PUBLIC_ORIGIN = "https://www.jobut.ir";

export function getPublicOrigin(environment: Record<string, string | undefined> = process.env) {
  const configured = environment.APP_URL?.trim();
  if (!configured) return STAGE_A_PUBLIC_ORIGIN;
  try {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
      return STAGE_A_PUBLIC_ORIGIN;
    }
    return url.origin;
  } catch {
    return STAGE_A_PUBLIC_ORIGIN;
  }
}
