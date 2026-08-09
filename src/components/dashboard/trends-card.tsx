import { ChartSpline } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/dashboard/card";
import type { DatasetRow, RollingRow } from "@/lib/analytics-types";
import { FIELDS, type FieldKey } from "@/lib/fields";
import { daysAgoStr } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

const RANGES = [7, 30, 90, 365] as const;
const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

export function TrendsCard() {
  const [range, setRange] = useState<number>(90);
  const [smooth, setSmooth] = useState(true);
  const [selected, setSelected] = useState<FieldKey[]>([
    "codingHours",
    "sleepHours",
    "commits",
    "programmingScore",
  ]);

  const startDate = daysAgoStr(range - 1);
  const endDate = daysAgoStr(0);

  const raw: DatasetRow[] | undefined = useQuery(api.analytics.getDataset, { startDate, endDate });
  const rolling: RollingRow[] | undefined = useQuery(api.analytics.getRollingAverages, {
    startDate,
    endDate,
    windowDays: 7,
  });

  const loading = raw === undefined || rolling === undefined;

  // Daily values on a 90-day window are mostly noise; the 7-day rolling mean is
  // what makes a trend legible. Both are available because the raw series is
  // what the statistics are actually computed from.
  const data = smooth
    ? (rolling ?? []).map((r) => ({ date: r.date, label: r.date.slice(5), ...r.averages }))
    : (raw ?? []).map((r) => ({ ...r, label: r.date.slice(5) }));

  const toggle = (key: FieldKey) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Card
      title="Trends"
      description="How each field moves over time, self-reported and measured on the same axis."
      icon={ChartSpline}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-3 py-1 font-mono text-xs transition-colors",
                range === r
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === 365 ? "1y" : `${r}d`}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={smooth}
            onChange={(e) => setSmooth(e.target.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          7-day rolling mean
        </label>
        <span className="font-mono text-xs text-muted-foreground">
          {loading ? "Loading…" : `${raw?.length ?? 0} days with data`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FIELDS.map((f) => {
          const active = selected.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggle(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  f.source === "github" ? "bg-chart-2" : "bg-chart-5",
                )}
              />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 h-72 w-full">
        {selected.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">Select at least one field to plot.</p>
          </div>
        ) : data.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : "No data in this range yet — back-fill from GitHub or add a daily log."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--color-popover-foreground)",
                }}
                formatter={(value: number | string) =>
                  typeof value === "number" ? value.toFixed(2) : value
                }
              />
              {selected.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={FIELDS.find((f) => f.key === key)?.label ?? key}
                  stroke={COLORS[i % COLORS.length] ?? COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Gaps in a line are days with no data for that field — they are not zeros, and the statistics
        drop them rather than filling them in.
      </p>
    </Card>
  );
}
