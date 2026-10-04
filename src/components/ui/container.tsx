import type { ElementType, HTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

type ContainerWidth = "content" | "dashboard";

interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  width?: ContainerWidth;
}

const widthClasses: Record<ContainerWidth, string> = {
  content: "max-w-[var(--layout-content)]",
  dashboard: "max-w-[var(--layout-dashboard)]",
};

export function Container({
  as: Component = "div",
  width = "content",
  className,
  ...props
}: ContainerProps) {
  return (
    <Component
      className={classNames(
        "mx-auto w-full px-[var(--page-padding)]",
        widthClasses[width],
        className,
      )}
      {...props}
    />
  );
}
