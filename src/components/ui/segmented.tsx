import { cn } from "@/lib/utils";

// The same row-of-pills range picker was copy-pasted into three cards with
// slightly different padding each time. One component keeps them identical,
// and keeps them out of `<select>` — a range switch with three options
// shouldn't cost a dropdown to read.

type SegmentedOption<T> = { value: T; label: string };

type SegmentedProps<T> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
};

export function Segmented<T extends string | number>({
  options,
  value,
  onValueChange,
  className,
  ...props
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn("inline-flex rounded-xl border border-border bg-muted/30 p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-lg px-3 py-1 font-mono text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
