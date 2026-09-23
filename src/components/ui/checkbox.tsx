import * as React from "react";
import { cn } from "../../lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          "touch-target group inline-flex cursor-pointer items-start gap-2.5 select-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="relative flex items-center justify-center pt-0.5">
          <input
            id={checkboxId}
            type="checkbox"
            ref={ref}
            disabled={disabled}
            className={cn(
              "h-5 w-5 rounded-sm border border-stone-300 text-teal-700 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 disabled:cursor-not-allowed",
              className
            )}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="text-sm">
            {label && <span className="font-medium text-stone-900 leading-none">{label}</span>}
            {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
          </div>
        )}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
