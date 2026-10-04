import type { ButtonHTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "small" | "default" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-action text-white hover:bg-action-hover disabled:bg-action/60",
  secondary:
    "border-ui-border bg-surface text-text-primary hover:bg-surface-elevated disabled:text-text-muted",
  ghost:
    "border-transparent bg-transparent text-text-secondary hover:bg-surface-elevated hover:text-text-primary disabled:text-text-muted",
  destructive:
    "border-transparent bg-danger text-white hover:bg-danger-hover disabled:bg-danger/60",
};

const sizeClasses: Record<ButtonSize, string> = {
  small: "min-h-9 px-3 text-sm",
  default: "min-h-11 px-4 text-sm",
  large: "min-h-12 px-5 text-base",
};

interface ButtonClassNamesOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function buttonClassNames({
  variant = "primary",
  size = "default",
  className,
}: ButtonClassNamesOptions = {}) {
  return classNames(
    "inline-flex max-w-full items-center justify-center gap-2 rounded-md border font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-70",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassNames({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
