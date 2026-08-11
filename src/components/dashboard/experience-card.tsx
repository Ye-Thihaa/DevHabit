import { BadgeCheck } from "lucide-react";
import { useQuery } from "convex/react";

import { Card } from "@/components/dashboard/card";
import { api } from "@convex/_generated/api";

type Signals = {
  observedSpanDays: number;
  firstActiveDate: string | null;
  activeDays: number;
  distinctLanguages: number;
  totalCommits: number;
  totalReviews: number;
  totalPullRequests: number;
  reposTouched: number;
  selfRatedExperience: number | null;
  selfRatedFrom: string | null;
};

function Signal({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="stat-num mt-0.5 text-xl font-semibold">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

export function ExperienceCard() {
  const s = useQuery(api.profile.getExperienceSignals, {}) as Signals | null | undefined;

  if (s === undefined) {
    return (
      <Card title="Experience signals" icon={BadgeCheck}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }
  if (s === null) return null;

  const months = Math.round(s.observedSpanDays / 30);

  return (
    <Card
      title="Experience signals"
      description="What the data records about your activity — stated as facts, not as a rating."
      icon={BadgeCheck}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Signal
          label="History covered"
          value={months >= 1 ? `${months} mo` : `${s.observedSpanDays} d`}
          {...(s.firstActiveDate ? { note: `since ${s.firstActiveDate}` } : {})}
        />
        <Signal label="Days with commits" value={String(s.activeDays)} />
        <Signal label="Languages used" value={String(s.distinctLanguages)} />
        <Signal label="Commits" value={s.totalCommits.toLocaleString()} />
        <Signal label="PRs opened" value={String(s.totalPullRequests)} />
        <Signal
          label="PRs reviewed"
          value={String(s.totalReviews)}
          note="reviewing others' code"
        />
      </div>

      {s.selfRatedExperience !== null && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-chart-5/40 bg-chart-5/10 p-3">
          <div>
            <p className="text-sm">
              You rated your own experience{" "}
              <span className="stat-num font-medium">{s.selfRatedExperience}/5</span>
              {s.selfRatedFrom && (
                <span className="text-muted-foreground"> on {s.selfRatedFrom}</span>
              )}
              .
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This is your own answer from the daily log. It is shown next to the measured numbers,
              never mixed into them.
            </p>
          </div>
        </div>
      )}

      {/* The honest limit of the feature, stated where someone reading the
          numbers will actually see it rather than buried in a footnote. */}
      <p className="mt-4 text-xs text-muted-foreground">
        There is deliberately no &ldquo;junior / senior&rdquo; verdict here. Commit counts, lines
        changed and hours logged measure activity, not competence — a senior engineer often commits
        less than a beginner, and line counts reward verbosity. These numbers are shown so you can
        judge for yourself; the app will not do it for you.
      </p>
    </Card>
  );
}
