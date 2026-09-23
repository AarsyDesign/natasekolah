import * as React from "react";
import { cn } from "../../lib/utils";

export interface ColumnDef<T> {
  header: string;
  align?: "left" | "right" | "center";
  className?: string;
  cell: (item: T) => React.ReactNode;
}

export interface DataTableViewProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  mobileCardRenderer?: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function DataTableView<T>({
  data,
  columns,
  keyExtractor,
  mobileCardRenderer,
  emptyState,
  isLoading,
  className,
}: DataTableViewProps<T>) {
  if (data.length === 0 && !isLoading) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-stone-500 shadow-2xs">
        {emptyState || <p className="text-sm">Tidak ada data untuk ditampilkan.</p>}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* 1. Desktop Tabular Grid (md:table) */}
      <div className="hidden md:block w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/90 text-xs font-semibold uppercase tracking-wider text-stone-600">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={cn(
                    "px-4 py-3 align-middle",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.align === "left" && "text-left",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm text-stone-800">
            {data.map((item, rowIdx) => (
              <tr
                key={keyExtractor(item, rowIdx)}
                className="transition-colors hover:bg-stone-50/70"
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={cn(
                      "px-4 py-3 align-middle",
                      col.align === "right" && "text-right tabular-nums",
                      col.align === "center" && "text-center",
                      col.align === "left" && "text-left",
                      col.className
                    )}
                  >
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Mobile Responsive ResourceList (md:hidden) */}
      <div className="md:hidden space-y-2.5">
        {mobileCardRenderer ? (
          data.map((item, idx) => (
            <div
              key={keyExtractor(item, idx)}
              className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-2xs"
            >
              {mobileCardRenderer(item, idx)}
            </div>
          ))
        ) : (
          // Default fallback card if mobileCardRenderer is not provided
          data.map((item, rowIdx) => (
            <div
              key={keyExtractor(item, rowIdx)}
              className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-stone-900 text-sm">
                  {columns[0]?.cell(item)}
                </div>
                {columns.length > 1 && (
                  <div className="shrink-0">{columns[columns.length - 1]?.cell(item)}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-stone-100 text-stone-600">
                {columns.slice(1, -1).map((col, colIdx) => (
                  <div key={colIdx} className="space-y-0.5">
                    <span className="text-[10px] uppercase font-semibold text-stone-400 block">
                      {col.header}
                    </span>
                    <span className="font-medium text-stone-800">{col.cell(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
