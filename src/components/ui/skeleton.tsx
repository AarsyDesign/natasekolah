import * as React from "react";
import { cn } from "../../lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded bg-stone-200/70",
        shimmer ? "animate-shimmer" : "animate-pulse",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
