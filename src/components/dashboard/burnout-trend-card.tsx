import { Activity } from "lucide-react";
import { useQuery } from "convex/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

type HistoryRow = { date: string; score: number; level: "low" | "moderate" | "high"; sampleSize: number };

const LEVEL_COLOR: Record<HistoryRow["level"], string> = {
  low: "var(--color-success)",
  moderate: "var(--color-chart-5)",
  high: "var(--color-destructive)",
};

export function BurnoutTrendCard() {
  const history: HistoryRow[] | undefined = useQuery(api.burnoutHistory.getBurnoutHistory, {
    days: 90,
  });

  const data = (history ?? []).map((r) => ({ ...r, label: r.date.slice(5) }));

  return (
    <Card
      title="Burnout trend"
      description="Your daily burnout score over time — one snapshot per day, not point-in-time."
      icon={Activity}
    >
      <div className="h-56 w-full">
        {history === undefined ? (
          <div className="grid h-full place-items-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : data.length < 2 ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Not enough history yet — a snapshot is taken once a day, so a trend line needs at least
              a couple of days to appear.
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
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
              />
              <ReferenceLine y={33} stroke="var(--color-border)" strokeDasharray="4 4" />
              <ReferenceLine y={66} stroke="var(--color-border)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--color-popover-foreground)",
                }}
                formatter={(value: number, _name, item) => [
                  `${value} (${(item?.payload as HistoryRow | undefined)?.level ?? ""})`,
                  "Score",
                ]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={(props: {
                  cx?: number;
                  cy?: number;
                  payload?: HistoryRow;
                  key?: string | number;
                }) => {
                  const { cx, cy, payload, key } = props;
                  if (cx === undefined || cy === undefined || !payload) {
                    return <circle key={key} r={0} />;
                  }
                  return (
                    <circle
                      key={key}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={LEVEL_COLOR[payload.level]}
                      stroke="none"
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Dashed lines mark the low/moderate and moderate/high thresholds (33, 66). Dot color matches
        that day's risk level.
      </p>
    </Card>
  );
}
