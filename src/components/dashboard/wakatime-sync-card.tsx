import { Timer, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

export function WakatimeSyncCard() {
  const user = useQuery(api.users.getCurrentUser);
  const setWakatimeApiKey = useMutation(api.users.setWakatimeApiKey);
  const syncRecent = useAction(api.wakatime.syncRecent);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSaveKey = async () => {
    if (!draft.trim()) return;
    try {
      await setWakatimeApiKey({ wakatimeApiKey: draft.trim() });
      setDraft("");
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Failed to save API key.");
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await syncRecent({ days: 30 });
      setResult(
        `Wrote ${res.daysWritten} day(s) — ${res.totalCodingHours.toFixed(1)}h logged, ${res.startDate} → ${res.endDate}.`,
      );
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="WakaTime ingestion"
      description="Measured coding time from your editor, pulled with your own WakaTime API key."
      icon={Timer}
    >
      {user === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !user?.wakatimeApiKey ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="wakatime-key">WakaTime API key</Label>
            <Input
              id="wakatime-key"
              placeholder="waka_..."
              className="font-mono"
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveKey}>Save</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">WakaTime key saved.</span>
            <Link to="/settings" className="ml-auto text-xs underline text-muted-foreground">
              Replace or remove key
            </Link>
          </div>
          <Button disabled={busy} onClick={handleSync}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Syncing…" : "Sync last 30 days"}
          </Button>
          {result && <p className="font-mono text-xs text-success">{result}</p>}
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Find your key at{" "}
            <a
              href="https://wakatime.com/settings/api-key"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              wakatime.com/settings/api-key
            </a>
            . When present, WakaTime hours are used instead of your self-reported coding hours in
            the burnout score.
          </p>
        </div>
      )}
      {error && !user?.wakatimeApiKey && (
        <p className="mt-2 font-mono text-xs text-destructive">{error}</p>
      )}
    </Card>
  );
}
