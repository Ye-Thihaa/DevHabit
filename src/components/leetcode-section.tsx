import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertCircle, CheckCircle2, Code2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

// Unlike the WakaTime key above it, a LeetCode username is public — there is
// nothing to mask and nothing secret to type as a password field. Connecting
// is just naming a public profile to read from.
export function LeetcodeSection() {
  const user = useQuery(api.users.getCurrentUser);
  const setUsername = useMutation(api.users.setLeetcodeUsername);
  const clearUsername = useMutation(api.users.clearLeetcodeUsername);
  const syncNow = useAction(api.leetcode.syncNow);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "save" | "sync" | "remove">(null);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const username = user?.leetcodeUsername ?? null;

  const save = async () => {
    if (!draft.trim()) return;
    setBusy("save");
    setStatus(null);
    try {
      await setUsername({ leetcodeUsername: draft.trim() });
      setDraft("");
      setEditing(false);
      setStatus({ kind: "success", message: "LeetCode username saved. Sync to pull today's totals." });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Failed to save username.",
      });
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    setStatus(null);
    try {
      const result = await syncNow({});
      setStatus({
        kind: "success",
        message:
          result.solvedToday === undefined
            ? `Connected. First snapshot recorded — ${result.totalSolved} solved total. Tomorrow's sync will start showing a daily count.`
            : `Synced — ${result.solvedToday} solved since the last snapshot (${result.totalSolved} total).`,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Sync failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    setStatus(null);
    try {
      await clearUsername({});
      setStatus({
        kind: "success",
        message: "LeetCode disconnected. Problems solved will fall back to your daily log.",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof ConvexError ? (err.data as string) : "Failed to disconnect.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Code2 className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-medium">LeetCode</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Once connected, problems solved is measured from your public profile instead of typed
            into the daily log. LeetCode has no per-day history to pull from, so the count only
            starts building from the day you connect — nothing before that can be back-filled.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {user === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !username && !editing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="leetcode-username">LeetCode username</Label>
              <Input
                id="leetcode-username"
                placeholder="your-leetcode-username"
                className="font-mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <Button disabled={busy !== null} onClick={() => void save()}>
              {busy === "save" && <Loader2 className="size-4 animate-spin" />}
              Connect
            </Button>
          </div>
        ) : editing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="leetcode-username-replace">New LeetCode username</Label>
              <Input
                id="leetcode-username-replace"
                placeholder="your-leetcode-username"
                className="font-mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={busy !== null} onClick={() => void save()}>
                {busy === "save" && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
              <Button
                variant="outline"
                disabled={busy !== null}
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
              <a
                href={`https://leetcode.com/${username}/`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline"
              >
                {username}
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void sync()}>
                {busy === "sync" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Sync now
              </Button>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => setEditing(true)}>
                Replace username
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => void remove()}
              >
                {busy === "remove" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Disconnect
              </Button>
            </div>
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
        Uses LeetCode's public profile data — this only works if your profile is not set to private.
      </p>
    </section>
  );
}
