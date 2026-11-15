import { classNames } from "@/lib/class-names";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <span
      aria-label="جابوکار"
      data-priority={priority || undefined}
      className={classNames(
        "inline-flex w-fit flex-col items-center text-center leading-none text-action",
        className,
      )}
    >
      <span className="font-brand text-2xl font-black">جابوکار</span>
      <span className="mt-1 text-[0.62rem] font-bold tracking-[0.18em]" dir="ltr">JOBOKAR</span>
    </span>
  );
}
