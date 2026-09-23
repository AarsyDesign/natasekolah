import * as React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      "touch-target inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variantStyles = {
      primary: "bg-teal-700 text-white shadow-2xs hover:bg-teal-800 active:bg-teal-900",
      secondary: "bg-stone-100 text-stone-800 hover:bg-stone-200 active:bg-stone-300",
      outline: "border border-stone-200 bg-white text-stone-700 shadow-2xs hover:bg-stone-50 hover:text-stone-900 hover:border-stone-300 active:bg-stone-100",
      ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200",
      destructive: "bg-red-600 text-white shadow-2xs hover:bg-red-700 active:bg-red-800",
    };

    const sizeStyles = {
      default: "min-h-[44px] px-4 py-2 text-sm",
      sm: "h-8 min-h-[32px] px-3 text-xs",
      lg: "min-h-[48px] px-6 py-3 text-base",
      icon: "min-h-[44px] min-w-[44px] p-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
