import Image from "next/image";
import { classNames } from "@/lib/class-names";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/main_logo.png"
      alt="شبکه استخدامی متخصصین آکادمیک"
      width={1448}
      height={1086}
      priority={priority}
      className={classNames("h-auto w-28 object-contain", className)}
    />
  );
}
