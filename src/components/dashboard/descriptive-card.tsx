import { Sigma } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import type { DescriptiveStats } from "@/lib/analytics-types";
import { FIELD_BY_KEY } from "@/lib/fields";
import { daysAgoStr } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

const RANGES = [30, 90, 365] as const;

function fmt(value: number | null, unit?: string | null) {
  if (value === null) return "—";
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return unit ? `${rounded}${unit}` : rounded;
}

export function DescriptiveCard() {
  const [range, setRange] = useState<number>(90);
  const [includeSeeded, setIncludeSeeded] = useState(true);

  const stats: DescriptiveStats | undefined = useQuery(api.analytics.getDescriptiveStats, {
    startDate: daysAgoStr(range - 1),
    endDate: daysAgoStr(0),
    includeSeeded,
  });

  return (
    <Card
      title="Descriptive statistics"
      description="The five-number summary behind every chart on this page."
      icon={Sigma}
    >
      <div className="flex flex-wrap items-center gap-3">
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
            checked={includeSeeded}
            onChange={(e) => setIncludeSeeded(e.target.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          Include seed data
        </label>
      </div>

      {stats === undefined ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] px-1 text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-left font-normal">Field</th>
                <th className="py-2 text-right font-normal">n</th>
                <th className="py-2 text-right font-normal">mean</th>
                <th className="py-2 text-right font-normal">sd</th>
                <th className="py-2 text-right font-normal">min</th>
                <th className="py-2 text-right font-normal">median</th>
                <th className="py-2 text-right font-normal">max</th>
                <th className="py-2 text-right font-normal">missing</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          row.source === "github" ? "bg-chart-2" : "bg-chart-5",
                        )}
                      />
                      {FIELD_BY_KEY[row.key]?.label ?? row.label}
                    </span>
                  </td>
                  <td className="stat-num py-1.5 text-right text-xs">{row.n}</td>
                  <td className="stat-num py-1.5 text-right text-xs">{fmt(row.mean, row.unit)}</td>
                  <td className="stat-num py-1.5 text-right text-xs text-muted-foreground">
                    {fmt(row.sd)}
                  </td>
                  <td className="stat-num py-1.5 text-right text-xs text-muted-foreground">
                    {fmt(row.min)}
                  </td>
                  <td className="stat-num py-1.5 text-right text-xs">{fmt(row.median)}</td>
                  <td className="stat-num py-1.5 text-right text-xs text-muted-foreground">
                    {fmt(row.max)}
                  </td>
                  <td
                    className={cn(
                      "stat-num py-1.5 text-right text-xs",
                      row.missingDays > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {row.missingDays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-chart-5 align-middle" />{" "}
        self-reported ·{" "}
        <span className="inline-block size-1.5 rounded-full bg-chart-2 align-middle" /> measured
        from GitHub. sd is the sample standard deviation (n−1); &ldquo;missing&rdquo; counts days in
        the range with no value for that field.
      </p>
    </Card>
  );
}
