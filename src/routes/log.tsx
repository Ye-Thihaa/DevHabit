import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppNav } from "@/components/app-nav";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Daily Log — devhabit" },
      {
        name: "description",
        content:
          "Record today's coding hours, sleep, coffee, commits, AI tool usage and self-rated scores in one short form.",
      },
      { property: "og:title", content: "Daily Log — devhabit" },
      {
        property: "og:description",
        content: "Record one day of coding habits and output in a single short form.",
      },
    ],
  }),
  component: DailyLog,
});

type NumField = {
  key: string;
  label: string;
  hint: string;
  step?: string;
  max?: number;
};

const numberFields: NumField[] = [
  { key: "codingHours", label: "Coding Hours", hint: "hours", step: "0.5", max: 24 },
  { key: "sleepHours", label: "Sleep Hours", hint: "hours", step: "0.5", max: 24 },
  { key: "coffeeIntake", label: "Coffee Intake", hint: "cups", step: "1", max: 30 },
  { key: "githubCommits", label: "GitHub Commits", hint: "commits", step: "1", max: 500 },
  { key: "aiToolUsageMinutes", label: "AI Tool Usage", hint: "minutes", step: "5", max: 1440 },
  { key: "problemsSolved", label: "Problems Solved", hint: "count", step: "1", max: 200 },
];

const scaleFields = [
  { key: "taskDifficulty", label: "Task Difficulty", max: 5, hint: "1 = trivial, 5 = brutal" },
  { key: "experienceLevel", label: "Experience Level", max: 5, hint: "1 = new, 5 = expert" },
  { key: "programmingScore", label: "Programming Score", max: 10, hint: "self-rated 1–10" },
];

function DailyLog() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const addDailyLog = useMutation(api.dailyLogs.addDailyLog);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [values, setValues] = useState<Record<string, string>>({
    codingHours: "",
    sleepHours: "",
    coffeeIntake: "",
    githubCommits: "",
    aiToolUsageMinutes: "",
    problemsSolved: "",
    taskDifficulty: "3",
    experienceLevel: "4",
    programmingScore: "7",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

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
    for (const f of numberFields) {
      const raw = values[f.key] ?? "";
      if (raw.trim() === "") {
        next[f.key] = "This field is required.";
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) next[f.key] = "Enter a valid number.";
      else if (n < 0) next[f.key] = "Must be zero or more.";
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
    if (!isAuthenticated || !date) return;

    setSaving(true);
    setStatus(null);
    try {
      await addDailyLog({
        date: format(date, "yyyy-MM-dd"),
        codingHours: Number(values["codingHours"]),
        sleepHours: Number(values["sleepHours"]),
        coffeeIntake: Number(values["coffeeIntake"]),
        githubCommits: Number(values["githubCommits"]),
        aiToolUsageMinutes: Number(values["aiToolUsageMinutes"]),
        problemsSolved: Number(values["problemsSolved"]),
        taskDifficulty: Number(values["taskDifficulty"]),
        experienceLevel: Number(values["experienceLevel"]),
        programmingScore: Number(values["programmingScore"]),
      });
      setStatus({
        kind: "success",
        message: `Log saved for ${format(date, "yyyy-MM-dd")}. Dashboard will refresh with this entry.`,
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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-semibold sm:text-3xl">Daily log</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One entry per day. Rough numbers are fine — consistency matters more than precision.
        </p>

        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7"
        >
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <div className="max-w-xs">
              <DatePicker date={date} onSelect={setDate} invalid={Boolean(errors["date"])} />
            </div>
            <FieldError message={errors["date"]} />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {numberFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="relative">
                  <Input
                    id={f.key}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={f.step}
                    placeholder="0"
                    aria-invalid={Boolean(errors[f.key])}
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={cn(
                      "stat-num pr-16",
                      errors[f.key] && "border-destructive focus-visible:ring-destructive/40",
                    )}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-muted-foreground">
                    {f.hint}
                  </span>
                </div>
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
                    {Array.from({ length: f.max }, (_, i) => String(i + 1)).map((n) => (
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
              {saving ? "Saving…" : "Save Log"}
            </Button>
          </div>
        </form>
      </main>
    </div>
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
