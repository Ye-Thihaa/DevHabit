import { Github, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export function GithubSyncCard({ userId }: { userId: Id<"users"> }) {
  const user = useQuery(api.users.getUser, { userId });
  const setGithubUsername = useMutation(api.users.setGithubUsername);
  const syncGithubCommits = useAction(api.github.syncGithubCommits);

  const [draft, setDraft] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!draft.trim()) return;
    await setGithubUsername({ userId, githubUsername: draft.trim() });
    setDraft("");
  };

  const handleSync = async () => {
    if (!date) return;
    setSyncing(true);
    setSynced(null);
    setError(null);
    try {
      const count = await syncGithubCommits({ userId, date: format(date, "yyyy-MM-dd") });
      setSynced(`${count} commit(s) found and written to that day's log.`);
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Failed to sync commits.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card
      title="GitHub sync"
      description="Pull real commit counts so your output metric isn't self-reported."
      icon={Github}
    >
      {user === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !user.githubUsername ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="gh-username">GitHub username</Label>
            <Input
              id="gh-username"
              placeholder="octocat"
              className="font-mono"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <Button onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Linked GitHub account:</span>
            <span className="font-mono font-medium">{user.githubUsername}</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-56">
              <Label>Sync date</Label>
              <DatePicker date={date} onSelect={setDate} />
            </div>
            <Button disabled={syncing} onClick={handleSync}>
              {syncing && <Loader2 className="size-4 animate-spin" />}
              {syncing ? "Syncing…" : "Sync Commits from GitHub"}
            </Button>
          </div>
          {synced && <p className="font-mono text-xs text-success">{synced}</p>}
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>
      )}
    </Card>
  );
}
