import * as React from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, children, className }: DialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop with subtle fade-in */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container with scale & fade enter */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-md text-stone-900 max-h-[90vh] overflow-y-auto animate-modal-enter",
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="touch-target absolute top-4 right-4 rounded-md p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
          aria-label="Tutup dialog"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1 pr-6", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold text-stone-900 leading-tight", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-stone-500", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-4 border-t border-stone-100", className)}
      {...props}
    />
  );
}
