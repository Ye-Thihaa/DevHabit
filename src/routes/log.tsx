import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Code2, Github, Loader2, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELF_FIELDS } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Daily Log — devhabit" },
      {
        name: "description",
        content:
          "Record the things GitHub can't measure: sleep, coffee, focus time, task difficulty and how the day felt.",
      },
      { property: "og:title", content: "Daily Log — devhabit" },
      {
        property: "og:description",
        content: "Record one day of self-reported coding habits in a single short form.",
      },
    ],
  }),
  component: DailyLog,
});

const scaleFields = SELF_FIELDS.filter((f) => f.scale);

const DEFAULTS: Record<string, string> = {
  taskDifficulty: "3",
  experienceLevel: "4",
  programmingScore: "7",
};

function emptyValues() {
  return Object.fromEntries(SELF_FIELDS.map((f) => [f.key, DEFAULTS[f.key] ?? ""])) as Record<
    string,
    string
  >;
}

function DailyLog() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const saveDailyLog = useMutation(api.dailyLogs.saveDailyLog);
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  // Once WakaTime/LeetCode are connected, the corresponding field is measured
  // rather than typed in — the form stops asking for what it can now get
  // elsewhere.
  const hasWakatime = Boolean(user?.wakatimeApiKey);
  const hasLeetcode = Boolean(user?.leetcodeUsername);
  const numberFields = useMemo(
    () =>
      SELF_FIELDS.filter(
        (f) =>
          !f.scale &&
          !(hasWakatime && f.key === "codingHours") &&
          !(hasLeetcode && f.key === "problemsSolved"),
      ),
    [hasWakatime, hasLeetcode],
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Which date the form fields currently reflect, so loading an existing entry
  // doesn't clobber edits in progress.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const dateStr = date ? format(date, "yyyy-MM-dd") : null;

  const existing = useQuery(
    api.dailyLogs.getLogForDate,
    isAuthenticated && dateStr ? { date: dateStr } : "skip",
  );

  // Editing an already-logged day should show what's stored rather than a
  // blank form — the mutation upserts, so a blank form would silently wipe it.
  useEffect(() => {
    if (!dateStr || existing === undefined || loadedFor === dateStr) return;
    if (existing === null) {
      setValues(emptyValues());
    } else {
      setValues(
        Object.fromEntries(
          SELF_FIELDS.map((f) => [f.key, String(existing[f.key as keyof typeof existing] ?? "")]),
        ) as Record<string, string>,
      );
    }
    setErrors({});
    setLoadedFor(dateStr);
  }, [dateStr, existing, loadedFor]);

  const isEditing = existing !== undefined && existing !== null;
  const editingSeeded = isEditing && existing.isSeeded === true;

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!date) next["date"] = "Pick the day this entry is for.";
    else if (dateStr && dateStr > format(new Date(), "yyyy-MM-dd")) {
      next["date"] = "That day hasn't happened yet.";
    }

    for (const f of numberFields) {
      const raw = values[f.key] ?? "";
      if (raw.trim() === "") {
        next[f.key] = "This field is required.";
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) next[f.key] = "Enter a valid number.";
      else if (f.min !== undefined && n < f.min) next[f.key] = `Must be ${f.min} or more.`;
      else if (f.max !== undefined && n > f.max) next[f.key] = `Must be ${f.max} or less.`;
    }
    return next;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setStatus({
        kind: "error",
        message: `Couldn't save — ${Object.keys(next).length} field(s) need attention.`,
      });
      return;
    }
    if (!isAuthenticated || !dateStr) return;

    setSaving(true);
    setStatus(null);
    try {
      // Only the fields actually shown get submitted — when WakaTime is
      // connected, codingHours is omitted rather than sent as a stale/empty
      // value, so analytics.buildDataset's measured figure isn't overwritten.
      const payload = Object.fromEntries(
        [...numberFields, ...scaleFields].map((f) => [f.key, Number(values[f.key])]),
      ) as Record<string, number>;

      const result = await saveDailyLog({ date: dateStr, ...payload });

      setStatus({
        kind: "success",
        message: result.created ? `Log saved for ${dateStr}.` : `Log for ${dateStr} updated.`,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Failed to save log.",
      });
    } finally {
      setSaving(false);
    }
  };

  const scaleOptions = useMemo(
    () =>
      Object.fromEntries(
        scaleFields.map((f) => [
          f.key,
          Array.from({ length: f.max ?? 5 }, (_, i) => String(i + 1)),
        ]),
      ),
    [],
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      title="Daily log"
      description="Only the things GitHub can't see. Rough numbers are fine — consistency matters more than precision."
    >
      <div className="max-w-3xl">
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Github className="mt-0.5 size-4 shrink-0" />
          <p>
            Commits, pull requests, reviews and lines changed are pulled from the GitHub API on the
            dashboard — they aren't entered here, so the output side of the analysis stays measured
            rather than remembered.
          </p>
        </div>

        {hasWakatime && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Timer className="mt-0.5 size-4 shrink-0" />
            <p>
              Coding hours are pulled from WakaTime instead — sync them from the WakaTime ingestion
              card on the dashboard rather than typing them in here.
            </p>
          </div>
        )}

        {hasLeetcode && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Code2 className="mt-0.5 size-4 shrink-0" />
            <p>
              Problems solved is pulled from LeetCode instead — sync it from Settings rather than
              typing it in here.
            </p>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7"
        >
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <div className="max-w-xs">
              <DatePicker date={date} onSelect={setDate} invalid={Boolean(errors["date"])} />
            </div>
            <FieldError message={errors["date"]} />
            {isEditing && (
              <p className="font-mono text-xs text-muted-foreground">
                {editingSeeded
                  ? "This day currently holds generated seed data — saving replaces it with your real entry."
                  : "Editing an existing entry for this day."}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {numberFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <NumberStepper
                  id={f.key}
                  value={values[f.key] ?? ""}
                  onValueChange={(v) => set(f.key, v)}
                  min={f.min}
                  max={f.max}
                  step={Number(f.step ?? 1)}
                  suffix={f.hint}
                  invalid={Boolean(errors[f.key])}
                />
                <FieldError message={errors[f.key]} />
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {scaleFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Select value={values[f.key] ?? "1"} onValueChange={(v) => set(f.key, v)}>
                  <SelectTrigger id={f.key} className="stat-num w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(scaleOptions[f.key] ?? []).map((n) => (
                      <SelectItem key={n} value={n} className="stat-num">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-mono text-xs text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>

          {status && (
            <div
              role="status"
              className={cn(
                "mt-7 flex items-start gap-2 rounded-lg border p-3 text-sm",
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

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : isEditing ? "Update Log" : "Save Log"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="size-3.5" />
      {message}
    </p>
  );
}
