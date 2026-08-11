import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertCircle, CheckCircle2, Loader2, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// Goals are display-only by design: they change what a card compares against
// and nothing else. Keeping them out of the analysis means an ambitious target
// can never bend a correlation or a prediction toward what the user hoped for.
const GOAL_FIELDS = [
  { key: "codingHours", label: "Coding hours", suffix: "hours", step: 0.5, max: 24 },
  { key: "sleepHours", label: "Sleep hours", suffix: "hours", step: 0.5, max: 24 },
  { key: "commits", label: "Commits", suffix: "per day", step: 1, max: 200 },
] as const;

type GoalKey = (typeof GOAL_FIELDS)[number]["key"];

export function GoalsSection() {
  const user = useQuery(api.users.getCurrentUser);
  const setGoals = useMutation(api.users.setGoals);

  const [drafts, setDrafts] = useState<Record<GoalKey, string>>({
    codingHours: "",
    sleepHours: "",
    commits: "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Seeded from the server once the user record arrives; an empty string is a
  // deliberate "no goal" rather than a zero.
  useEffect(() => {
    if (!user) return;
    const goals = user.goals ?? {};
    setDrafts({
      codingHours: goals.codingHours != null ? String(goals.codingHours) : "",
      sleepHours: goals.sleepHours != null ? String(goals.sleepHours) : "",
      commits: goals.commits != null ? String(goals.commits) : "",
    });
  }, [user]);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const args: Record<string, number | null> = {};
      for (const field of GOAL_FIELDS) {
        const raw = drafts[field.key].trim();
        args[field.key] = raw === "" ? null : Number(raw);
      }
      await setGoals(args);
      setStatus({ kind: "success", message: "Goals saved." });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Failed to save goals.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Target className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-medium">Daily goals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What you're aiming for on a normal day. Leave a field empty to compare against your own
            recent average instead. Goals only change what the dashboard compares against — no
            statistic is computed from them.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {GOAL_FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`goal-${field.key}`}>{field.label}</Label>
            <NumberStepper
              id={`goal-${field.key}`}
              value={drafts[field.key]}
              onValueChange={(v) => setDrafts((prev) => ({ ...prev, [field.key]: v }))}
              step={field.step}
              min={0}
              max={field.max}
              suffix={field.suffix}
              placeholder="—"
            />
          </div>
        ))}
      </div>

      {status && (
        <div
          role="status"
          className={cn(
            "mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm",
            status.kind === "success"
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {status.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      <div className="mt-5">
        <Button onClick={() => void save()} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Saving…" : "Save goals"}
        </Button>
      </div>
    </section>
  );
}
