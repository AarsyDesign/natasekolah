import * as React from "react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";

/**
 * CardSkeleton: Reusable metric/stat card skeleton matching final UI dimensions.
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-stone-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

/**
 * TableSkeleton: Reusable data table skeleton with column headers and rows.
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full rounded-lg border border-stone-200 bg-white overflow-hidden shadow-2xs", className)}>
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`th-${i}`} className={cn("h-4", i === 0 ? "w-32" : "w-20")} />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-stone-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex items-center justify-between px-4 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`td-${r}-${c}`}
                className={cn(
                  "h-4",
                  c === 0 ? "w-36" : c === columns - 1 ? "w-16 rounded-md" : "w-24"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ListSkeleton: Reusable vertical list skeleton matching resource items.
 */
export function ListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * FormSkeleton: Reusable form skeleton with inputs and submit button.
 */
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-stone-200 bg-white p-5 shadow-2xs space-y-4", className)}>
      <Skeleton className="h-5 w-40 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
      <div className="pt-2 flex justify-end">
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}

/**
 * PageSkeleton: Comprehensive page skeleton with banner, metric grid, and content area.
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Banner */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Content Area */}
      <TableSkeleton rows={4} columns={4} />
    </div>
  );
}
