export type EmployerIdentifier = {
  type: "email" | "mobile";
  value: string;
};

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = persianDigits.indexOf(digit);
    return String(persianIndex >= 0 ? persianIndex : arabicDigits.indexOf(digit));
  });
}

export function normalizeEmployerIdentifier(input: string): EmployerIdentifier | null {
  const trimmed = input.trim();

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    const isReasonableEmail =
      email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    return isReasonableEmail ? { type: "email", value: email } : null;
  }

  const compact = toLatinDigits(trimmed).replace(/[\s()-]/g, "");
  const localNumber = compact.match(/^(?:\+98|98|0)?(9\d{9})$/)?.[1];

  return localNumber ? { type: "mobile", value: `+98${localNumber}` } : null;
}
