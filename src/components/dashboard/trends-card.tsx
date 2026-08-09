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
import { FIELDS, type FieldKey } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

const RANGES = [7, 30, 90] as const;
const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function TrendsCard({ userId }: { userId: Id<"users"> }) {
  const [range, setRange] = useState<number>(30);
  const [selected, setSelected] = useState<FieldKey[]>([
    "codingHours",
    "sleepHours",
    "githubCommits",
    "programmingScore",
  ]);

  const logs = useQuery(api.dailyLogs.getLogsInRange, {
    userId,
    startDate: daysAgoStr(range - 1),
    endDate: daysAgoStr(0),
  });

  const data = (logs ?? []).map((e: Doc<"dailyLogs">) => ({ ...e, label: e.date.slice(5) }));

  const toggle = (key: FieldKey) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Card title="Trends" description="How each tracked field moves over time." icon={ChartSpline}>
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
              Last {r}d
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {logs === undefined ? "Loading…" : `${data.length} days of data available`}
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
                "rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
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
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {logs === undefined ? "Loading…" : "No logs in this range yet."}
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
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
