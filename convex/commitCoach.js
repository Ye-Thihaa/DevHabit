import { action } from "./_generated/server";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { generateText } from "./lib/llm.js";

// Feedback on commit message clarity, not a code review — the LLM never
// sees a diff, only the subject lines. Reuses the same Anthropic → Groq →
// mock chain the weekly summary and burnout narration already go through
// (see convex/lib/llm.js), so this needed no new provider wiring.
//
// GITHUB_TOKEN here is the same shared deployment token every other
// convex/github.js action uses (see requireToken there) — it queries
// /user/repos, so on a deployment shared by multiple users this reads the
// token owner's commits regardless of who clicked the button. That is an
// existing limitation of the whole detailed-sync path, not something new
// introduced here.

const GITHUB_REST = "https://api.github.com";
const MAX_REPOS = 8;
const MAX_MESSAGES = 30;

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

// GitHub commit messages can be multi-paragraph; only the subject line
// (everything before the first blank line) is the part a "good commit
// message" convention actually judges.
function subjectLineOf(fullMessage) {
  return fullMessage.split("\n")[0].trim();
}

async function fetchRecentSubjects(token, login) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

  const reposResponse = await fetch(
    `${GITHUB_REST}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator`,
    { headers },
  );
  if (!reposResponse.ok) {
    const text = await reposResponse.text();
    throw new ConvexError(`GitHub REST error (${reposResponse.status}): ${text.slice(0, 300)}`);
  }
  const repos = (await reposResponse.json()).slice(0, MAX_REPOS);

  const subjects = [];
  for (const repo of repos) {
    if (subjects.length >= MAX_MESSAGES) break;

    const listResponse = await fetch(
      `${GITHUB_REST}/repos/${repo.full_name}/commits` +
        `?author=${encodeURIComponent(login)}&per_page=${MAX_MESSAGES}`,
      { headers },
    );
    // 409 = empty repository, 404 = no access. Neither is fatal — just skip it.
    if (listResponse.status === 409 || listResponse.status === 404) continue;
    if (!listResponse.ok) continue;

    const commits = await listResponse.json();
    for (const commit of commits) {
      if (subjects.length >= MAX_MESSAGES) break;
      const message = commit.commit?.message;
      if (typeof message === "string" && message.trim()) {
        subjects.push(subjectLineOf(message));
      }
    }
  }

  return subjects;
}

function buildPrompt(subjects) {
  return `You are a senior developer giving quick, friendly feedback on commit message habits — not a code review, you have not seen any diffs, only the messages themselves.

Here are up to ${MAX_MESSAGES} of this developer's most recent commit subject lines, newest activity mixed across their repos (not necessarily in chronological order):

${subjects.map((s) => `- ${s}`).join("\n")}

Write feedback covering:
1. One sentence on the overall pattern you notice (e.g. terse vs descriptive, consistent vs inconsistent style, present-tense imperative vs not).
2. 1-3 specific messages from the list above that are vague (like "fix", "update", "wip", "asdf") and what a clearer version might say instead — quote the original.
3. One thing they're already doing well, if anything is.

Keep it to a short paragraph plus a few bullets — encouraging in tone, specific in substance. Do not comment on code quality, architecture, or anything you cannot see from a one-line message. Respond with plain text, no markdown headers.`;
}

function buildMockFeedback(subjects) {
  const vague = subjects.filter((s) =>
    /^(fix|update|wip|misc|stuff|asdf|changes?|test)\.?$/i.test(s.trim()),
  );
  return (
    "[Mock feedback — set ANTHROPIC_API_KEY or GROQ_API_KEY on this deployment for real " +
    `AI-generated feedback] Looked at ${subjects.length} recent commit message(s); ` +
    `${vague.length} looked vague (e.g. "fix", "wip") and could name what actually changed instead.`
  );
}

export const getCommitMessageFeedback = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not signed in");
    }

    const user = await ctx.runQuery(api.users.getCurrentUser);
    if (!user?.githubUsername) {
      throw new ConvexError("Link a GitHub username before requesting feedback.");
    }

    const token = requireToken();
    const subjects = await fetchRecentSubjects(token, user.githubUsername);

    if (subjects.length === 0) {
      throw new ConvexError(
        "No recent commits found to review. Back-fill from GitHub first, or make sure your " +
          "GitHub username is correct in Settings.",
      );
    }

    const result = await generateText({
      prompt: buildPrompt(subjects),
      maxTokens: 512,
      label: "give feedback on these commit messages",
    });

    return {
      feedback: result ? result.text : buildMockFeedback(subjects),
      messagesReviewed: subjects.length,
    };
  },
});
