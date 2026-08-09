import { action, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { dateRange, daysBetween, shiftDateString } from "./lib/stats.js";

// Ingestion of the measured layer.
//
// Two levels, deliberately separate:
//
//   backfillCalendar  one GraphQL request returns a full year of per-day
//                     contribution counts. Cheap, and the only realistic way
//                     to get a dataset large enough to analyse on day one.
//
//   syncCommitDetail  walks REST commit endpoints for a date range to add
//                     timestamps and diff sizes. Costs roughly one request per
//                     repo plus one per commit, so it is range-limited and run
//                     on demand rather than over the whole history.

const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const GITHUB_REST = "https://api.github.com";

// GitHub's contributions calendar caps at one year per query.
const MAX_CALENDAR_DAYS = 365;
// Detailed sync is bounded so a single call can't spend thousands of requests.
const MAX_DETAIL_DAYS = 31;
const MAX_REPOS_PER_DETAIL_SYNC = 30;
const MAX_COMMITS_PER_DETAIL_SYNC = 300;

function requireToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new ConvexError(
      "No GITHUB_TOKEN set on this deployment. Create a GitHub personal access token " +
        "with 'public_repo' + 'read:user' scope and run: npx convex env set GITHUB_TOKEN <token>",
    );
  }
  return token;
}

function bucketForHour(hour) {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

async function resolveUser(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");

  const user = await ctx.runQuery(api.users.getCurrentUser);
  if (!user) throw new ConvexError("User not found");
  if (!user.githubUsername) {
    throw new ConvexError("Link a GitHub username before syncing");
  }
  return { userId, login: user.githubUsername };
}

// --- calendar backfill ---------------------------------------------------

const CONTRIBUTIONS_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) { nodes { occurredAt } }
        }
        issueContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) { nodes { occurredAt } }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) { nodes { occurredAt } }
        }
        contributionCalendar {
          weeks {
            contributionDays { date contributionCount }
          }
        }
      }
    }
  }
`;

function countByDate(repositories) {
  const counts = {};
  for (const repo of repositories ?? []) {
    for (const node of repo.contributions?.nodes ?? []) {
      const date = node.occurredAt.slice(0, 10);
      counts[date] = (counts[date] ?? 0) + 1;
    }
  }
  return counts;
}

export const backfillCalendar = action({
  args: {
    // How far back to pull. Defaults to a full year, which is what makes the
    // dataset large enough for the correlations to mean anything.
    days: v.optional(v.number()),
  },
  handler: async (ctx, { days = MAX_CALENDAR_DAYS }) => {
    const { userId, login } = await resolveUser(ctx);
    const token = requireToken();

    const span = Math.min(Math.max(Math.floor(days), 1), MAX_CALENDAR_DAYS);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = shiftDateString(endDate, -(span - 1));

    let payload;
    try {
      const response = await fetch(GITHUB_GRAPHQL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: CONTRIBUTIONS_QUERY,
          variables: {
            login,
            from: `${startDate}T00:00:00Z`,
            to: `${endDate}T23:59:59Z`,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ConvexError(`GitHub GraphQL error (${response.status}): ${text.slice(0, 300)}`);
      }
      payload = await response.json();
    } catch (err) {
      await ctx.runMutation(internal.github.recordSyncRun, {
        userId,
        kind: "calendar",
        startDate,
        endDate,
        daysWritten: 0,
        status: "error",
        message: err instanceof ConvexError ? String(err.data) : "Network error reaching GitHub",
      });
      throw err;
    }

    if (payload.errors?.length) {
      const message = payload.errors.map((e) => e.message).join("; ");
      await ctx.runMutation(internal.github.recordSyncRun, {
        userId,
        kind: "calendar",
        startDate,
        endDate,
        daysWritten: 0,
        status: "error",
        message,
      });
      throw new ConvexError(`GitHub GraphQL error: ${message}`);
    }

    const collection = payload.data?.user?.contributionsCollection;
    if (!collection) {
      throw new ConvexError(`GitHub user "${login}" not found or not visible with this token.`);
    }

    const prByDate = countByDate(collection.pullRequestContributionsByRepository);
    const issueByDate = countByDate(collection.issueContributionsByRepository);
    const reviewByDate = countByDate(collection.pullRequestReviewContributionsByRepository);

    const rows = [];
    for (const week of collection.contributionCalendar?.weeks ?? []) {
      for (const day of week.contributionDays ?? []) {
        if (day.date < startDate || day.date > endDate) continue;
        rows.push({
          date: day.date,
          // The calendar's contributionCount folds commits, PRs, issues and
          // reviews into one number. Subtracting the three we counted
          // separately leaves the commit contributions.
          commits: Math.max(
            day.contributionCount -
              (prByDate[day.date] ?? 0) -
              (issueByDate[day.date] ?? 0) -
              (reviewByDate[day.date] ?? 0),
            0,
          ),
          pullRequestsOpened: prByDate[day.date] ?? 0,
          issuesOpened: issueByDate[day.date] ?? 0,
          reviews: reviewByDate[day.date] ?? 0,
        });
      }
    }

    const written = await ctx.runMutation(internal.github.writeCalendarDays, { userId, rows });

    await ctx.runMutation(internal.github.recordSyncRun, {
      userId,
      kind: "calendar",
      startDate,
      endDate,
      daysWritten: written,
      status: "ok",
    });

    return {
      startDate,
      endDate,
      daysWritten: written,
      activeDays: rows.filter((r) => r.commits > 0).length,
      totalCommits: rows.reduce((sum, r) => sum + r.commits, 0),
    };
  },
});

// --- detailed sync -------------------------------------------------------

export const syncCommitDetail = action({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const { userId, login } = await resolveUser(ctx);
    const token = requireToken();

    const span = daysBetween(startDate, endDate);
    if (span < 0) throw new ConvexError("startDate must be on or before endDate");
    if (span + 1 > MAX_DETAIL_DAYS) {
      throw new ConvexError(
        `Detailed sync is limited to ${MAX_DETAIL_DAYS} days per run (asked for ${span + 1}). ` +
          "It walks every commit in the range, so it is rate-limit heavy — run it month by month.",
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };

    const reposResponse = await fetch(
      `${GITHUB_REST}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator`,
      { headers },
    );
    if (!reposResponse.ok) {
      const text = await reposResponse.text();
      throw new ConvexError(`GitHub REST error (${reposResponse.status}): ${text.slice(0, 300)}`);
    }
    const repos = await reposResponse.json();

    // Repos not pushed to since the window opened cannot contain commits in it.
    const windowStartMs = new Date(startDate + "T00:00:00Z").getTime();
    const candidates = repos
      .filter((repo) => new Date(repo.pushed_at ?? 0).getTime() >= windowStartMs)
      .slice(0, MAX_REPOS_PER_DETAIL_SYNC);

    // date -> accumulator
    const byDate = {};
    const ensure = (date) => {
      if (!byDate[date]) {
        byDate[date] = {
          date,
          additions: 0,
          deletions: 0,
          repos: new Set(),
          buckets: { night: 0, morning: 0, afternoon: 0, evening: 0 },
          commits: 0,
        };
      }
      return byDate[date];
    };

    let commitsInspected = 0;
    let truncated = false;

    for (const repo of candidates) {
      if (commitsInspected >= MAX_COMMITS_PER_DETAIL_SYNC) {
        truncated = true;
        break;
      }

      const listUrl =
        `${GITHUB_REST}/repos/${repo.full_name}/commits` +
        `?author=${encodeURIComponent(login)}` +
        `&since=${startDate}T00:00:00Z&until=${endDate}T23:59:59Z&per_page=100`;

      const listResponse = await fetch(listUrl, { headers });
      // 409 = empty repository, 404 = no access. Neither is fatal for the run.
      if (listResponse.status === 409 || listResponse.status === 404) continue;
      if (!listResponse.ok) {
        const text = await listResponse.text();
        throw new ConvexError(`GitHub REST error (${listResponse.status}): ${text.slice(0, 300)}`);
      }

      const commits = await listResponse.json();
      for (const commit of commits) {
        if (commitsInspected >= MAX_COMMITS_PER_DETAIL_SYNC) {
          truncated = true;
          break;
        }
        commitsInspected++;

        // Author date, not committer date — rebases rewrite the latter and
        // would smear a day's work onto whenever the rebase happened.
        const authored = commit.commit?.author?.date;
        if (!authored) continue;
        const date = authored.slice(0, 10);
        if (date < startDate || date > endDate) continue;

        const acc = ensure(date);
        acc.commits++;
        acc.repos.add(repo.full_name);
        acc.buckets[bucketForHour(new Date(authored).getUTCHours())]++;

        // The list endpoint omits diff stats; one extra request per commit.
        const detailResponse = await fetch(
          `${GITHUB_REST}/repos/${repo.full_name}/commits/${commit.sha}`,
          { headers },
        );
        if (detailResponse.ok) {
          const detail = await detailResponse.json();
          acc.additions += detail.stats?.additions ?? 0;
          acc.deletions += detail.stats?.deletions ?? 0;
        }
      }
    }

    const rows = dateRange(startDate, endDate).map((date) => {
      const acc = byDate[date];
      return {
        date,
        commits: acc?.commits ?? 0,
        additions: acc?.additions ?? 0,
        deletions: acc?.deletions ?? 0,
        reposTouched: acc ? acc.repos.size : 0,
        commitsByBucket: acc?.buckets ?? { night: 0, morning: 0, afternoon: 0, evening: 0 },
      };
    });

    const written = await ctx.runMutation(internal.github.writeDetailDays, { userId, rows });

    await ctx.runMutation(internal.github.recordSyncRun, {
      userId,
      kind: "detailed",
      startDate,
      endDate,
      daysWritten: written,
      status: "ok",
      message: truncated
        ? `Stopped at the ${MAX_COMMITS_PER_DETAIL_SYNC}-commit cap — the range is only partly detailed.`
        : undefined,
    });

    return { startDate, endDate, daysWritten: written, commitsInspected, truncated };
  },
});

// --- writers -------------------------------------------------------------

export const writeCalendarDays = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(
      v.object({
        date: v.string(),
        commits: v.number(),
        pullRequestsOpened: v.number(),
        issuesOpened: v.number(),
        reviews: v.number(),
      }),
    ),
  },
  handler: async (ctx, { userId, rows }) => {
    let written = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("githubDaily")
        .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", row.date))
        .unique();

      if (existing) {
        // A detailed row is strictly richer than a calendar row, so refresh the
        // counts but leave detailLevel and the diff fields alone.
        await ctx.db.patch(existing._id, {
          ...row,
          fetchedAt: Date.now(),
          detailLevel: existing.detailLevel === "detailed" ? "detailed" : "calendar",
        });
      } else {
        await ctx.db.insert("githubDaily", {
          userId,
          ...row,
          detailLevel: "calendar",
          fetchedAt: Date.now(),
        });
      }
      written++;
    }
    return written;
  },
});

export const writeDetailDays = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(
      v.object({
        date: v.string(),
        commits: v.number(),
        additions: v.number(),
        deletions: v.number(),
        reposTouched: v.number(),
        commitsByBucket: v.object({
          night: v.number(),
          morning: v.number(),
          afternoon: v.number(),
          evening: v.number(),
        }),
      }),
    ),
  },
  handler: async (ctx, { userId, rows }) => {
    let written = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("githubDaily")
        .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", row.date))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...row,
          detailLevel: "detailed",
          fetchedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("githubDaily", {
          userId,
          ...row,
          pullRequestsOpened: 0,
          issuesOpened: 0,
          reviews: 0,
          detailLevel: "detailed",
          fetchedAt: Date.now(),
        });
      }
      written++;
    }
    return written;
  },
});

export const recordSyncRun = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("calendar"), v.literal("detailed"), v.literal("migration")),
    startDate: v.string(),
    endDate: v.string(),
    daysWritten: v.number(),
    status: v.union(v.literal("ok"), v.literal("error")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("syncRuns", { ...args, ranAt: Date.now() });
  },
});

// --- reads ---------------------------------------------------------------

export const getSyncHistory = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("syncRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});
