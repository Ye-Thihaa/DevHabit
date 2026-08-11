import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// Replaces `<input type="number">` and the browser's own spinner arrows,
// which render differently in every browser and are ~10px of hit area.
// The native spinners are hidden in styles.css; these buttons are the
// only increase/decrease affordance.
//
// The value stays a string so a half-typed "" or "3." survives editing —
// callers parse it themselves, exactly as they did with a bare input.

type NumberStepperProps = {
  id?: string | undefined;
  value: string;
  onValueChange: (value: string) => void;
  // Spelled with an explicit `| undefined` because the project runs with
  // exactOptionalPropertyTypes, and callers pass optional field metadata
  // straight through from lib/fields.
  step?: number | undefined;
  min?: number | undefined;
  max?: number | undefined;
  /** Short unit shown inside the field, e.g. "hours" or "cups". */
  suffix?: string | undefined;
  invalid?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
};

function decimalsOf(step: number) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function NumberStepper({
  id,
  value,
  onValueChange,
  step = 1,
  min,
  max,
  suffix,
  invalid,
  placeholder = "0",
  className,
}: NumberStepperProps) {
  const clamp = (n: number) => {
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };

  const nudge = (direction: 1 | -1) => {
    const current = Number(value);
    // An empty or unparseable field steps from the floor rather than NaN.
    const base = Number.isFinite(current) ? current : (min ?? 0);
    const next = clamp(base + direction * step);
    // Float arithmetic on a 0.5 step otherwise produces 7.300000000000001.
    onValueChange(next.toFixed(decimalsOf(step)));
  };

  const parsed = Number(value);
  const atMin = min !== undefined && Number.isFinite(parsed) && parsed <= min;
  const atMax = max !== undefined && Number.isFinite(parsed) && parsed >= max;

  const buttonClass =
    "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors " +
    "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 " +
    "focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30";

  return (
    <div
      className={cn(
        "flex h-11 items-center gap-1 rounded-xl border border-input bg-muted/30 p-1.5 transition-colors",
        "focus-within:border-ring/60 focus-within:bg-muted/50",
        invalid && "border-destructive focus-within:border-destructive",
        className,
      )}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={() => nudge(-1)}
        disabled={atMin}
        aria-label="Decrease"
        tabIndex={-1}
      >
        <Minus className="size-4" />
      </button>

      <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          placeholder={placeholder}
          aria-invalid={invalid}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="stat-num w-full min-w-0 border-0 bg-transparent p-0 text-center text-base font-medium outline-none placeholder:text-muted-foreground/60"
        />
        {suffix && (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{suffix}</span>
        )}
      </div>

      <button
        type="button"
        className={buttonClass}
        onClick={() => nudge(1)}
        disabled={atMax}
        aria-label="Increase"
        tabIndex={-1}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
