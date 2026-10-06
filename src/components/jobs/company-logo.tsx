interface CompanyLogoProps {
  companyName: string;
  logoUrl: string | null;
  size?: "small" | "large";
}

export function CompanyLogo({ companyName, logoUrl, size = "small" }: CompanyLogoProps) {
  const sizeClass = size === "large" ? "size-16 text-xl" : "size-11 text-base";

  if (logoUrl) {
    return (
      // Company logo references may later use a replaceable external storage provider.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`لوگوی ${companyName}`}
        className={`${sizeClass} shrink-0 rounded-lg border bg-surface object-cover`}
      />
    );
  }

  return (
    <span aria-hidden="true" className={`${sizeClass} grid shrink-0 place-items-center rounded-lg border bg-surface-elevated font-bold text-action`}>
      {companyName.trim().charAt(0) || "ج"}
    </span>
  );
}
