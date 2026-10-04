import type { HTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={classNames("my-0 w-full border-0 border-t border-ui-border", className)}
      {...props}
    />
  );
}
