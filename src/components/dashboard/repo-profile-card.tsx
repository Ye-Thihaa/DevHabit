import { FolderGit2, Loader2, Star } from "lucide-react";
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";

import { Card } from "@/components/dashboard/card";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";

type RepoProfile = {
  total: number;
  owned: number;
  forks: number;
  languages: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  recent: {
    fullName: string;
    description: string | null;
    primaryLanguage: string | null;
    topics: string[];
    stars: number;
    isPrivate: boolean;
    pushedAt: string | null;
  }[];
  syncedAt: number | null;
};

export function RepoProfileCard() {
  const profile = useQuery(api.profile.getRepoProfile, {}) as RepoProfile | null | undefined;
  const sync = useAction(api.github.syncRepoProfile);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await sync({});
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const syncButton = (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void run()}>
      {busy && <Loader2 className="size-4 animate-spin" />}
      {busy ? "Syncing…" : profile && profile.total > 0 ? "Re-sync repos" : "Sync repositories"}
    </Button>
  );

  return (
    <Card
      title="What you build"
      description="Your repositories, as GitHub classifies them — its own language detection and the topics you set."
      icon={FolderGit2}
    >
      {profile === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : profile === null || profile.total === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No repository data yet. This is a separate one-off sync from the commit backfill — it
            reads what your repos are, not how much you committed.
          </p>
          {syncButton}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm">
            <span className="stat-num font-medium">{profile.owned}</span> repositories of your own
            {profile.forks > 0 && (
              <span className="text-muted-foreground">
                {" "}
                (plus {profile.forks} fork{profile.forks === 1 ? "" : "s"}, excluded below — what
                you forked isn&rsquo;t what you build)
              </span>
            )}
            .
          </p>

          {profile.languages.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Primary language, by repo</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.languages.slice(0, 10).map((l) => (
                  <span
                    key={l.name}
                    className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs"
                  >
                    {l.name} <span className="stat-num text-muted-foreground">{l.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.topics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Topics you tagged</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.topics.map((t) => (
                  <span
                    key={t.name}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs"
                  >
                    {t.name} <span className="stat-num text-muted-foreground">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium">Most recently pushed</h3>
            <ul className="mt-2 space-y-2">
              {profile.recent.map((repo) => (
                <li
                  key={repo.fullName}
                  className="rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {repo.fullName}
                    </span>
                    {repo.isPrivate && (
                      <span className="shrink-0 rounded border border-border px-1.5 text-[10px] text-muted-foreground">
                        private
                      </span>
                    )}
                    {repo.stars > 0 && (
                      <span className="stat-num flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Star className="size-3" />
                        {repo.stars}
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {repo.description}
                    </p>
                  )}
                  {repo.primaryLanguage && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {repo.primaryLanguage}
                      {repo.pushedAt ? ` · pushed ${repo.pushedAt.slice(0, 10)}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {syncButton}
            {profile.syncedAt && (
              <span className="font-mono text-xs text-muted-foreground">
                last synced {new Date(profile.syncedAt).toISOString().slice(0, 10)}
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <p className="mt-4 text-xs text-muted-foreground">
        Only repositories your token can see. With a <code className="font-mono">public_repo</code>{" "}
        token that means public ones only, so private work is missing from this picture.
      </p>
    </Card>
  );
}
