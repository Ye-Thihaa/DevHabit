import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertCircle, CheckCircle2, Loader2, Timer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { GoalsSection } from "@/components/goals-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — devhabit" },
      { name: "description", content: "Manage your connected WakaTime API key." },
    ],
  }),
  component: SettingsPage,
});

function maskKey(key: string) {
  if (key.length <= 4) return "•".repeat(key.length);
  return `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`;
}

function SettingsPage() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const setWakatimeApiKey = useMutation(api.users.setWakatimeApiKey);
  const clearWakatimeApiKey = useMutation(api.users.clearWakatimeApiKey);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const hasKey = Boolean(user?.wakatimeApiKey);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      await setWakatimeApiKey({ wakatimeApiKey: draft.trim() });
      setDraft("");
      setEditing(false);
      setStatus({ kind: "success", message: "WakaTime key saved." });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Failed to save key.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await clearWakatimeApiKey({});
      setConfirmingRemove(false);
      setStatus({
        kind: "success",
        message: "WakaTime key removed. Coding hours will fall back to your daily log until you reconnect.",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Failed to remove key.",
      });
    } finally {
      setBusy(false);
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
    <AppShell title="Settings" description="Manage the connections that feed your dashboard.">
      <div className="max-w-2xl">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Timer className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-medium">WakaTime</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Once connected, coding hours are measured automatically instead of typed into the
                daily log, and refresh on their own every ~20 minutes.
              </p>
            </div>
          </div>

          <div className="mt-5">
            {user === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !hasKey && !editing ? (
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
                <Button disabled={busy} onClick={handleSave}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Connect
                </Button>
              </div>
            ) : editing ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="wakatime-key-replace">New WakaTime API key</Label>
                  <Input
                    id="wakatime-key-replace"
                    placeholder="waka_..."
                    className="font-mono"
                    type="password"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={handleSave}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setDraft("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">Connected —</span>
                  <span className="font-mono text-xs">
                    {user?.wakatimeApiKey ? maskKey(user.wakatimeApiKey) : ""}
                  </span>
                </div>

                {!confirmingRemove ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      Replace key
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmingRemove(true)}
                    >
                      <Trash2 className="size-4" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
                    <p className="text-sm text-destructive">
                      Remove the WakaTime connection? Coding hours will fall back to self-reported.
                    </p>
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={handleRemove}
                      >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        Confirm remove
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirmingRemove(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {status && (
            <div
              role="status"
              className={cn(
                "mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm",
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

          <p className="mt-4 text-xs text-muted-foreground">
            Find your key at{" "}
            <a
              href="https://wakatime.com/settings/api-key"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              wakatime.com/settings/api-key
            </a>
            .
          </p>
        </section>

        <GoalsSection />
      </div>
    </AppShell>
  );
}
