export const JOB_PACKAGE_NAME_MAX_LENGTH = 120;
export const JOB_PACKAGE_INTEGER_MAX = 2_147_483_647;

export interface AdminPackageInput {
  name: string;
  priceToman: number;
  jobCredits: number;
  isActive: boolean;
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
  if (
    name.length === 0
    || name.length > JOB_PACKAGE_NAME_MAX_LENGTH
    || priceToman === null
    || jobCredits === null
    || (active !== null && active !== "on")
  ) return null;
  return { name, priceToman, jobCredits, isActive: active === "on" };
}

export function packageSnapshotFields(input: AdminPackageInput) {
  return {
    packageName: input.name,
    priceToman: input.priceToman,
    jobCredits: input.jobCredits,
  };
}
