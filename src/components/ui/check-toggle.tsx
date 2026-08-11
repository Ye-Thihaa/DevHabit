import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

// Replaces `<input type="checkbox">` + `accent-color`, which the browser
// draws itself — a different shape and size on every platform, and at
// 14px it sat awkwardly next to 12px filter text. This is a plain button
// with `role="switch"`, so nothing native renders.

type CheckToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

export function CheckToggle({
  checked,
  onCheckedChange,
  children,
  className,
}: CheckToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        checked
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 place-items-center rounded-full border transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {checked && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
