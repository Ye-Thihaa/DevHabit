import { ArrowDownRight, ArrowUpRight, Grid3x3 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { TechnicalDetails } from "@/components/dashboard/technical-details";
import { CheckToggle } from "@/components/ui/check-toggle";
import type { CorrelationCell, CorrelationMatrix } from "@/lib/analytics-types";
import { FIELD_BY_KEY } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type Cell = CorrelationCell;

type Link = {
  rowKey: string;
  colKey: string;
  rowLabel: string;
  colLabel: string;
  r: number;
  cell: Cell;
};

// Every significant pair, strongest first. The matrix answers "what is the
// number for X and Y", which is the wrong first question — a reader wants
// "what did you find", and that is a short ranked list, not 100 cells they
// have to scan for the dark ones.
function rankLinks(result: CorrelationMatrix): Link[] {
  const links: Link[] = [];
  for (const row of result.fields) {
    for (const col of result.fields) {
      if (row.key >= col.key) continue; // skip diagonal + duplicate mirror
      const cell = result.matrix[row.key]?.[col.key] as Cell | undefined;
      if (!cell || cell.r === null || !cell.significant) continue;
      links.push({
        rowKey: row.key,
        colKey: col.key,
        rowLabel: FIELD_BY_KEY[row.key]?.label ?? row.label,
        colLabel: FIELD_BY_KEY[col.key]?.label ?? col.label,
        r: cell.r,
        cell,
      });
    }
  }
  return links.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

// |r| bands, worded the way someone would say it out loud. The exact
// coefficient is still one click away under "show the numbers".
function strengthWord(r: number) {
  const magnitude = Math.abs(r);
  if (magnitude >= 0.7) return "strongly";
  if (magnitude >= 0.4) return "clearly";
  return "slightly";
}

function cellStyle(cell: Cell) {
  if (cell.r === null) return { backgroundColor: "var(--color-muted)" };
  // Non-significant cells are washed out rather than coloured by magnitude.
  // A strong-looking r from 9 noisy days should not read as a finding.
  const strength = cell.significant ? Math.abs(cell.r) : Math.abs(cell.r) * 0.25;
  const pct = Math.round(strength * 70);
  const base = cell.r >= 0 ? "var(--color-chart-2)" : "var(--color-chart-4)";
  return { backgroundColor: `color-mix(in oklab, ${base} ${pct}%, var(--color-card))` };
}

function formatP(p: number | null) {
  if (p === null) return "n/a";
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(3)}`;
}

export function CorrelationsCard() {
  const [includeSeeded, setIncludeSeeded] = useState(true);
  const result: CorrelationMatrix | undefined = useQuery(api.analytics.getCorrelationMatrix, {
    includeSeeded,
  });

  const links = result ? rankLinks(result) : [];

  return (
    <Card
      title="What goes together"
      description="Which habits tend to rise and fall together."
      icon={Grid3x3}
    >
      {result === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <CheckToggle checked={includeSeeded} onCheckedChange={setIncludeSeeded}>
            Include generated seed data
          </CheckToggle>

          {links.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No clear pattern yet — log more days and one may show up here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {links.slice(0, 5).map((link) => (
                <li
                  key={`${link.rowKey}-${link.colKey}`}
                  className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg",
                      link.r >= 0 ? "bg-chart-2/15 text-chart-2" : "bg-chart-4/15 text-chart-4",
                    )}
                  >
                    {link.r >= 0 ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                  </span>
                  <p className="text-sm leading-snug">
                    On days with more{" "}
                    <span className="font-medium">{link.rowLabel.toLowerCase()}</span>, you{" "}
                    {strengthWord(link.r)} tend to have{" "}
                    <span className="font-medium">
                      {link.r >= 0 ? "more" : "less"} {link.colLabel.toLowerCase()}
                    </span>
                    .
                    <span className="stat-num ml-1.5 text-xs text-muted-foreground">
                      ({link.cell.n} days)
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {links.length > 5 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {links.length - 5} weaker pattern(s) not shown — the full grid is below.
            </p>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            These are patterns that showed up together, not proof one caused the other.
          </p>

          <TechnicalDetails label="Show the full grid and the numbers behind it">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[880px] border-separate border-spacing-0.5 px-1">
              <thead>
                <tr>
                  <th className="w-32" />
                  {result.fields.map((f) => (
                    <th
                      key={f.key}
                      className="pb-2 font-mono text-[11px] font-normal text-muted-foreground"
                    >
                      {FIELD_BY_KEY[f.key]?.short ?? f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.fields.map((row) => (
                  <tr key={row.key}>
                    <th className="pr-3 text-right text-xs font-normal whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            row.source !== "self" ? "bg-chart-2" : "bg-chart-5",
                          )}
                        />
                        {row.label}
                      </span>
                    </th>
                    {result.fields.map((col) => {
                      const cell = result.matrix[row.key]?.[col.key] as Cell | undefined;
                      if (!cell) {
                        return <td key={col.key} className="rounded-md bg-muted px-2 py-2" />;
                      }
                      return (
                        <td
                          key={col.key}
                          style={cellStyle(cell)}
                          className={cn(
                            "stat-num rounded-md px-2 py-2 text-center text-[11px]",
                            cell.r !== null && !cell.significant && "text-muted-foreground",
                          )}
                          title={
                            cell.underpowered
                              ? `${row.label} × ${col.label}: only ${cell.n} overlapping day(s) — need ${result.minPairs}`
                              : `${row.label} × ${col.label}: r = ${cell.r?.toFixed(2)}, n = ${cell.n}, ${formatP(cell.p)}`
                          }
                        >
                          {cell.r === null ? "—" : cell.r.toFixed(2)}
                          {cell.significant && <sup className="ml-0.5 text-[8px]">*</sup>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Darker squares (blue or red) mean a stronger link. Hover any square for the exact
            numbers. Washed-out squares aren't reliable yet — there isn't enough data behind them.
          </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
                {result.totalDays} days in range · * = p &lt; 0.05
              </p>
            </div>

            <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                Cells are dimmed when the relationship isn't statistically significant, and blank
                when fewer than {result.minPairs} days overlap on both fields. Hover any cell for
                its exact r, n and p.
              </p>
              <p>
                This is a matrix of {result.fields.length}×{result.fields.length} tests, so a
                handful of stars are expected by chance alone. Treat a starred cell as a hypothesis
                worth testing on new data, not a result — and note that a correlation between two
                self-reported fields (
                <span className="inline-block size-1.5 rounded-full bg-chart-5 align-middle" />)
                can be produced by how you remember a day rather than by what happened in it.
              </p>
            </div>
          </TechnicalDetails>
        </>
      )}
    </Card>
  );
}
