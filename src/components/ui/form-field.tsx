import { cloneElement, type ReactElement, type ReactNode } from "react";
import { classNames } from "@/lib/class-names";
import { Label } from "./label";

interface FormFieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = cloneElement(children, {
    id,
    "aria-describedby": descriptionId,
    "aria-invalid": error ? true : children.props["aria-invalid"],
  });

  return (
    <div className={classNames("grid gap-[var(--field-spacing)]", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={`${id}-error`} className="text-helper text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-helper">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
