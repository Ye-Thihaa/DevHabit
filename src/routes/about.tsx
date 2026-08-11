import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Github, Loader2, PenLine, Timer } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { FIELDS, SOURCE_LABEL } from "@/lib/fields";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "What's measured — devhabit" },
      {
        name: "description",
        content:
          "Every field the dashboard analyses, where it comes from, and what the analysis can and cannot conclude from it.",
      },
    ],
  }),
  component: AboutPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

const SOURCES = [
  {
    icon: Github,
    name: "GitHub",
    kind: "Measured",
    what: "Commits, pull requests, reviews, lines changed, repos touched, and what time of day each commit landed.",
    limit:
      "Only work that reached GitHub, and only what your token can see — with a public_repo token, private repositories are invisible. Local commits, non-code work and reviewing over someone's shoulder leave no trace.",
  },
  {
    icon: Timer,
    name: "WakaTime",
    kind: "Measured",
    what: "Seconds spent in the editor per day, broken down by language, plus your longest unbroken sitting.",
    limit:
      "Only counts time in an editor with the plugin installed. Whiteboarding, reading docs and thinking in the shower are all real work that this records as zero. Days before you installed it are not zeroes — they are unknown, and the app treats them that way.",
  },
  {
    icon: PenLine,
    name: "Your daily log",
    kind: "Self-reported",
    what: "Sleep, coffee, AI tool usage, problems solved, task difficulty, and your own 1–10 rating of the day.",
    limit:
      "Typed in by you, from memory, usually after the fact. Subject to recall bias — and the days you forget to log are often the unusual ones, which biases every statistic that uses them.",
  },
];

function AboutPage() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      title="What's measured"
      description="Every number on this dashboard comes from one of three places. This page says which, and what each one can and cannot support."
    >
      <div className="max-w-3xl space-y-5">
        <Section title="The three sources, and why they are kept apart">
          <p>
            The database stores self-reported and measured data in separate tables. Nothing writes
            to both, so a row can never be a silent mix of the two. Every analysis joins them by
            date and tags each field with where it came from — that is why the charts show a dot
            next to each field name.
          </p>
          <p>
            The distinction matters because a correlation between two things you typed in yourself
            can be produced by how you <em>remember</em> a day rather than by what happened in it.
            A correlation between something you typed and something GitHub measured cannot.
          </p>
        </Section>

        <div className="grid gap-5 sm:grid-cols-1">
          {SOURCES.map((source) => {
            const Icon = source.icon;
            return (
              <section
                key={source.name}
                className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{source.name}</h2>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          source.kind === "Measured"
                            ? "bg-chart-2/15 text-chart-2"
                            : "bg-chart-5/15 text-chart-5",
                        )}
                      >
                        {source.kind}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{source.what}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">What it misses: </span>
                      {source.limit}
                    </p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <Section title="Every field, and where it comes from">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 text-left font-normal">Field</th>
                  <th className="py-2 text-left font-normal">Source</th>
                  <th className="py-2 text-right font-normal">Unit</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((field) => (
                  <tr key={field.key} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 text-foreground">{field.label}</td>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            field.source !== "self" ? "bg-chart-2" : "bg-chart-5",
                          )}
                        />
                        {SOURCE_LABEL[field.source]}
                      </span>
                    </td>
                    <td className="stat-num py-1.5 text-right text-xs">{field.unit ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="What the analysis does">
          <p>
            <span className="font-medium text-foreground">Averages and spread</span> describe a
            typical day. <span className="font-medium text-foreground">Correlations</span> look for
            pairs of fields that rise and fall together, and report a pair only when it clears a
            significance test and a minimum number of overlapping days — three points can produce a
            near-perfect correlation from pure noise.{" "}
            <span className="font-medium text-foreground">Lag analysis</span> checks whether one
            field today lines up with another tomorrow.{" "}
            <span className="font-medium text-foreground">Prediction</span> fits a straight line
            through your own history and reports an interval around the estimate.
          </p>
          <p>
            The <span className="font-medium text-foreground">burnout score</span> is rule-based,
            not a trained model: there is no labelled &ldquo;was this person burned out&rdquo;
            outcome in the data to train against, so a heuristic that shows its arithmetic is more
            honest than a model that would be fitting noise. When AI is used, it only rewords the
            score the rules produced — it never computes or overrides it.
          </p>
        </Section>

        <Section title="What it cannot tell you">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-foreground">Cause.</span> Everything here is
              observational. If sleep and commits move together, this data cannot say which one
              moved the other, or whether a third thing moved both.
            </li>
            <li>
              <span className="font-medium text-foreground">Skill.</span> Commit counts, lines
              changed and hours logged measure activity, not competence. A senior engineer often
              commits less than a beginner, and line counts reward verbosity. Nothing here produces
              a seniority label, on purpose.
            </li>
            <li>
              <span className="font-medium text-foreground">How you compare to others.</span> The
              app holds no data about any other developer. Every comparison it makes is against
              your own earlier weeks.
            </li>
            <li>
              <span className="font-medium text-foreground">Anything about a missing day.</span> A
              gap is not a zero. Days with no data are dropped from the statistics rather than
              counted as no activity.
            </li>
          </ul>
        </Section>

        <Section title="Generated demo data">
          <p>
            The project can generate synthetic days to exercise the analysis before enough real ones
            exist. Every generated row is flagged, every chart can exclude them, the data-quality
            card counts them separately, and the AI summary is told which rows they are. Seeding is
            disabled entirely on production deployments.
          </p>
          <p>
            A relationship recovered from generated data validates that the pipeline works. It is
            not evidence about the developer, and it must never be quoted as a finding.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
