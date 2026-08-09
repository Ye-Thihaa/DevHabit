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

const RANGES = [
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "1 year" },
] as const;

export function GithubSyncCard() {
  const user = useQuery(api.users.getCurrentUser);
  const setGithubUsername = useMutation(api.users.setGithubUsername);
  const backfillCalendar = useAction(api.github.backfillCalendar);
  const syncCommitDetail = useAction(api.github.syncCommitDetail);

  const [draft, setDraft] = useState("");
  const [range, setRange] = useState<number>(365);
  const [busy, setBusy] = useState<null | "calendar" | "detail">(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [detailStart, setDetailStart] = useState<Date | undefined>(
    new Date(Date.now() - 29 * 86_400_000),
  );
  const [detailEnd, setDetailEnd] = useState<Date | undefined>(new Date());

  const handleSaveUsername = async () => {
    if (!draft.trim()) return;
    await setGithubUsername({ githubUsername: draft.trim() });
    setDraft("");
  };

  const handleBackfill = async () => {
    setBusy("calendar");
    setResult(null);
    setError(null);
    try {
      const res = await backfillCalendar({ days: range });
      setResult(
        `Wrote ${res.daysWritten} day(s) — ${res.totalCommits} commits across ${res.activeDays} active day(s), ${res.startDate} → ${res.endDate}.`,
      );
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Backfill failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleDetail = async () => {
    if (!detailStart || !detailEnd) return;
    setBusy("detail");
    setResult(null);
    setError(null);
    try {
      const res = await syncCommitDetail({
        startDate: format(detailStart, "yyyy-MM-dd"),
        endDate: format(detailEnd, "yyyy-MM-dd"),
      });
      setResult(
        `Inspected ${res.commitsInspected} commit(s) across ${res.daysWritten} day(s)` +
          (res.truncated
            ? " — hit the per-run commit cap, so the range is only partly detailed."
            : "."),
      );
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Detailed sync failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="GitHub ingestion"
      description="The measured layer. Nothing here is typed in — it all comes from the GitHub API."
      icon={Github}
    >
      {user === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !user?.githubUsername ? (
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
          <Button onClick={handleSaveUsername}>Save</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Linked GitHub account:</span>
            <span className="font-mono font-medium">{user.githubUsername}</span>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Backfill contribution history</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                One GraphQL request returns a full year of per-day commit, PR, issue and review
                counts. This is what gets the dataset to a size where correlations mean anything.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Range</Label>
                <div className="flex rounded-lg border border-border p-0.5">
                  {RANGES.map((r) => (
                    <button
                      key={r.days}
                      type="button"
                      onClick={() => setRange(r.days)}
                      className={
                        "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                        (range === r.days
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button disabled={busy !== null} onClick={handleBackfill}>
                {busy === "calendar" && <Loader2 className="size-4 animate-spin" />}
                {busy === "calendar" ? "Backfilling…" : "Backfill from GitHub"}
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-5">
            <div>
              <h3 className="text-sm font-medium">Detailed commit sync</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Adds commit timestamps and diff sizes for a shorter window — this is what makes the
                time-of-day and lines-changed analysis possible. Rate-limit heavy, so run it a month
                at a time.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:w-48">
                <Label>From</Label>
                <DatePicker date={detailStart} onSelect={setDetailStart} />
              </div>
              <div className="space-y-2 sm:w-48">
                <Label>To</Label>
                <DatePicker date={detailEnd} onSelect={setDetailEnd} />
              </div>
              <Button variant="outline" disabled={busy !== null} onClick={handleDetail}>
                {busy === "detail" && <Loader2 className="size-4 animate-spin" />}
                {busy === "detail" ? "Syncing…" : "Sync Commit Detail"}
              </Button>
            </div>
          </div>

          {result && <p className="font-mono text-xs text-success">{result}</p>}
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Both need a <code className="font-mono">GITHUB_TOKEN</code> on the Convex deployment.
            Private repos are only visible if the token's scope covers them, so a gap here means
            &ldquo;not visible to this token&rdquo;, not &ldquo;no work done&rdquo;.
          </p>
        </div>
      )}
    </Card>
  );
}
