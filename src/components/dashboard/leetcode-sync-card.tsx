import { Code2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

// Connecting/replacing/removing the username lives on Settings, next to
// WakaTime's key. This mirrors WakatimeSyncCard's split: the sync action
// stays on the dashboard where the rest of ingestion lives, the credential
// (here, just a public username) stays where the rest of account config is.
export function LeetcodeSyncCard() {
  const user = useQuery(api.users.getCurrentUser);
  const syncNow = useAction(api.leetcode.syncNow);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await syncNow({});
      setResult(
        res.solvedToday === undefined
          ? `First snapshot recorded — ${res.totalSolved} solved total. Tomorrow's sync starts the daily count.`
          : `Synced — ${res.solvedToday} solved since the last snapshot (${res.totalSolved} total).`,
      );
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="LeetCode ingestion"
      description="Measured problems solved from your public LeetCode profile."
      icon={Code2}
    >
      {user === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !user?.leetcodeUsername ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Not connected.</p>
          <Link to="/settings" className="text-xs underline text-muted-foreground">
            Add your LeetCode username in Settings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Connected as</span>
            <span className="font-mono text-xs">{user.leetcodeUsername}</span>
            <Link to="/settings" className="ml-auto text-xs underline text-muted-foreground">
              Replace or disconnect
            </Link>
          </div>
          <Button disabled={busy} onClick={() => void handleSync()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Syncing…" : "Sync now"}
          </Button>
          {result && <p className="font-mono text-xs text-success">{result}</p>}
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            LeetCode has no per-day history, so this only snapshots today's totals — the daily count
            builds up one sync at a time from here on. A cron does this automatically once a day, so
            manual syncing is optional.
          </p>
        </div>
      )}
    </Card>
  );
}
