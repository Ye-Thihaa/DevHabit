import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

const STORAGE_PREFIX = "devhabit:dismissed-burnout-alert:";

// Dismissal is per-session (sessionStorage) and keyed by date, so a
// dismissal today doesn't silently suppress the same warning if it's still
// true tomorrow. No server-side alert table — this reads the same
// getBurnoutRisk query the Burnout risk card already uses, so there's
// nothing to keep in sync.
export function AlertBanner() {
  const risk = useQuery(api.burnout.getBurnoutRisk);
  const [dismissed, setDismissed] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const alertKey = risk?.level === "high" ? `${STORAGE_PREFIX}${today}` : null;

  useEffect(() => {
    if (alertKey && typeof window !== "undefined") {
      setDismissed(window.sessionStorage.getItem(alertKey) === "1");
    } else {
      setDismissed(false);
    }
  }, [alertKey]);

  if (!alertKey || dismissed) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-destructive">
          Your burnout risk is high right now ({risk?.score}/100).
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          See the Burnout risk card on the Overview tab for which signals are driving it.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-foreground"
        onClick={() => {
          if (alertKey) window.sessionStorage.setItem(alertKey, "1");
          setDismissed(true);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
