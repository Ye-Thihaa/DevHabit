import { Grid3x3 } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { FIELDS } from "@/lib/fields";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function cellStyle(v: number) {
  const pct = Math.round(Math.abs(v) * 70);
  const base = v >= 0 ? "var(--color-chart-2)" : "var(--color-chart-4)";
  return {
    backgroundColor: `color-mix(in oklab, ${base} ${pct}%, var(--color-card))`,
  };
}

export function CorrelationsCard({ userId }: { userId: Id<"users"> }) {
  const result = useQuery(api.dailyLogs.getCorrelationMatrix, { userId });

  return (
    <Card
      title="Correlations"
      description="Pearson correlation across every numeric field you track."
      icon={Grid3x3}
    >
      {result === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[620px] border-separate border-spacing-0.5 px-1">
              <thead>
                <tr>
                  <th className="w-28" />
                  {FIELDS.map((f) => (
                    <th
                      key={f.key}
                      className="pb-2 font-mono text-[11px] font-normal text-muted-foreground"
                    >
                      {f.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((row) => (
                  <tr key={row.key}>
                    <th className="pr-3 text-right text-xs font-normal whitespace-nowrap text-muted-foreground">
                      {row.label}
                    </th>
                    {FIELDS.map((col) => {
                      const v: number | null = result.matrix[row.key]?.[col.key] ?? null;
                      return (
                        <td
                          key={col.key}
                          style={cellStyle(v ?? 0)}
                          className="stat-num rounded-md px-2 py-2 text-center text-[11px]"
                          title={`${row.label} × ${col.label}: ${v === null ? "n/a" : v.toFixed(2)}`}
                        >
                          {v === null ? "—" : v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>−1.0</span>
              <span
                className="h-2 w-28 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-chart-4), var(--color-card), var(--color-chart-2))",
                }}
              />
              <span>+1.0</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              Based on {result.sampleSize} days of logged data
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
