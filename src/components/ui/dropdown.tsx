import * as React from "react";
import { cn } from "../../lib/utils";

interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export function Dropdown({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error("DropdownTrigger must be used within Dropdown");

  return (
    <div
      onClick={() => context.setIsOpen((prev) => !prev)}
      className={cn("inline-flex cursor-pointer select-none", className)}
      aria-haspopup="true"
      aria-expanded={context.isOpen}
    >
      {children}
    </div>
  );
}

export function DropdownContent({
  children,
  align = "right",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error("DropdownContent must be used within Dropdown");

  if (!context.isOpen) return null;

  return (
    <div
      role="menu"
      className={cn(
        "absolute z-40 mt-1 min-w-[180px] rounded-lg border border-stone-200 bg-white p-1 shadow-md transition-all focus:outline-hidden",
        align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  destructive = false,
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error("DropdownItem must be used within Dropdown");

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    context.setIsOpen(false);
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "touch-target flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors text-left disabled:pointer-events-none disabled:opacity-50",
        destructive
          ? "text-red-700 hover:bg-red-50 hover:text-red-800"
          : "text-stone-700 hover:bg-stone-100 hover:text-stone-900",
        className
      )}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 border-t border-stone-100" />;
}
