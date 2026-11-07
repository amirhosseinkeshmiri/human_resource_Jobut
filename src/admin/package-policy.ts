export const JOB_PACKAGE_NAME_MAX_LENGTH = 120;
export const JOB_PACKAGE_INTEGER_MAX = 2_147_483_647;

export interface AdminPackageInput {
  name: string;
  priceToman: number;
  jobCredits: number;
  isActive: boolean;
  displayOrder: number | null;
  displayValidityText: string | null;
  paymentDescription: string | null;
  onlineCheckoutEnabled: boolean;
}

function parsePositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= JOB_PACKAGE_INTEGER_MAX
    ? parsed
    : null;
}

export function parseAdminPackageInput(formData: FormData): AdminPackageInput | null {
  const rawName = formData.get("name");
  if (typeof rawName !== "string") return null;
  const name = rawName.trim();
  const priceToman = parsePositiveInteger(formData.get("priceToman"));
  const jobCredits = parsePositiveInteger(formData.get("jobCredits"));
  const active = formData.get("isActive");
  const onlineCheckout = formData.get("onlineCheckoutEnabled");
  const rawDisplayOrder = formData.get("displayOrder");
  const rawValidity = formData.get("displayValidityText");
  const rawPayment = formData.get("paymentDescription");
  const displayOrder = rawDisplayOrder === "" || rawDisplayOrder === null
    ? null
    : parseNonNegativeInteger(rawDisplayOrder);
  const displayValidityText = optionalBoundedText(rawValidity, 120);
  const paymentDescription = optionalBoundedText(rawPayment, 240);
  if (
    name.length === 0
    || name.length > JOB_PACKAGE_NAME_MAX_LENGTH
    || priceToman === null
    || jobCredits === null
    || (active !== null && active !== "on")
    || (onlineCheckout !== null && onlineCheckout !== "on")
    || displayOrder === undefined
    || displayValidityText === undefined
    || paymentDescription === undefined
  ) return null;
  return {
    name,
    priceToman,
    jobCredits,
    isActive: active === "on",
    displayOrder,
    displayValidityText,
    paymentDescription,
    onlineCheckoutEnabled: onlineCheckout === "on",
  };
}

function parseNonNegativeInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= JOB_PACKAGE_INTEGER_MAX ? parsed : undefined;
}

function optionalBoundedText(value: FormDataEntryValue | null, maxLength: number) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return undefined;
  return normalized;
}

export function packageSnapshotFields(input: AdminPackageInput) {
  return {
    packageName: input.name,
    priceToman: input.priceToman,
    jobCredits: input.jobCredits,
  };
}
