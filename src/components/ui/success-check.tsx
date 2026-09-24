import * as React from "react";
import { cn } from "../../lib/utils";

export interface SuccessCheckProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

export function SuccessCheck({ size = "default", className, ...props }: SuccessCheckProps) {
  const sizeMap = {
    sm: "h-6 w-6 stroke-[2.5]",
    default: "h-10 w-10 stroke-[2.5]",
    lg: "h-14 w-14 stroke-[2]",
  };

  return (
    <div
      role="status"
      aria-label="Operasi berhasil"
      className={cn("inline-flex items-center justify-center animate-fade-in", className)}
      {...props}
    >
      <div className="rounded-full bg-emerald-50 p-2 border border-emerald-200">
        <svg
          className={cn("text-emerald-700", sizeMap[size])}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            className="animate-checkmark"
          />
        </svg>
      </div>
    </div>
  );
}
