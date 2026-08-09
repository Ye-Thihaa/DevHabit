import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";

export const syncGithubCommits = action({
  args: {
    userId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, { userId, date }) => {
    const user = await ctx.runQuery(api.users.getUser, { userId });
    if (!user) {
      throw new ConvexError("User not found");
    }
    if (!user.githubUsername) {
      throw new ConvexError("Set a GitHub username before syncing commits");
    }

    const headers = { Accept: "application/vnd.github+json" };
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const searchQuery = `author:${user.githubUsername} author-date:${date}`;
    const response = await fetch(
      `https://api.github.com/search/commits?q=${encodeURIComponent(searchQuery)}`,
      { headers },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new ConvexError(`GitHub API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const commitCount = data.total_count ?? 0;

    await ctx.runMutation(internal.dailyLogs.setGithubCommits, {
      userId,
      date,
      githubCommits: commitCount,
    });

    return commitCount;
  },
});
