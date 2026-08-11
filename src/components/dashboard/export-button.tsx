import { Download } from "lucide-react";
import { useState } from "react";
import { useConvex } from "convex/react";

import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { FIELDS } from "@/lib/fields";
import type { DatasetRow } from "@/lib/analytics-types";
import { api } from "@convex/_generated/api";

// One row per date, exactly the joined dataset every statistic in the app is
// computed from — so a number here can be checked against the number on the
// dashboard. Provenance travels with it: the flags say which layers actually
// contributed to a row, and a blank cell means no data rather than zero.
const COLUMNS = [
  { key: "date", header: "date" },
  ...FIELDS.map((f) => ({ key: f.key, header: f.key })),
  { key: "codingHoursSource", header: "codingHoursSource" },
  { key: "problemsSolvedSource", header: "problemsSolvedSource" },
  { key: "hasSelfReported", header: "hasSelfReported" },
  { key: "hasGithub", header: "hasGithub" },
  { key: "hasWakatime", header: "hasWakatime" },
  { key: "hasLeetcode", header: "hasLeetcode" },
  { key: "isSeeded", header: "isSeeded" },
] as const;

export function ExportButton() {
  const convex = useConvex();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      // Fetched on click rather than subscribed to: the full history is a
      // lot of rows to hold live in a component that only needs them once.
      const rows = (await convex.query(api.analytics.getDataset, {})) as DatasetRow[];
      const csv = toCsv(
        rows as unknown as Record<string, unknown>[],
        COLUMNS as unknown as readonly { key: string; header: string }[],
      );
      const today = new Date().toISOString().slice(0, 10);
      downloadCsv(`devhabit-${today}.csv`, csv);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={() => void run()} disabled={busy}>
      <Download className="size-4" />
      <span className="hidden sm:inline">{busy ? "Preparing…" : "Export CSV"}</span>
    </Button>
  );
}
